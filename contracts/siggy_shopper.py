# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import urllib.parse

# Error Classifications for validator agreement
ERROR_EXPECTED  = "[EXPECTED]"   # Business logic (deterministic)
ERROR_EXTERNAL  = "[EXTERNAL]"   # External API (deterministic)
ERROR_TRANSIENT = "[TRANSIENT]"  # Network (non-deterministic)
ERROR_LLM       = "[LLM_ERROR]"  # LLM failure

class SiggyShopper(gl.Contract):
    owner: Address
    recommendations: TreeMap[str, str] # request_id -> JSON string
    purchases: TreeMap[str, bool]       # request_id -> purchased status

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.write
    def request_recommendation(self, request_id: str, situation: str) -> None:
        """
        Processes a shopping situation, searches the web, and selects a product.
        The equivalence validator ensures consensus under the Equivalent Principle.
        """
        if self.recommendations.get(request_id, "") != "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Recommendation already exists for request {request_id}")

        def leader_fn() -> str:
            # Step 1: Analyze intent and constraints using LLM
            analysis_prompt = f"""
            You are the Intent Analyzer for Siggy Shopper.
            Analyze the user's situation and extract the shopping intent.
            Situation: "{situation}"
            Return a JSON object with:
            - "query": a concise, effective search query to find this product online (e.g. "Beauty of Joseon sunscreen" or "trendy sneakers size 46").
            - "constraints": a description of specific constraints (size, skin type, platform, brand, budget, etc.).
            """
            analysis_raw = gl.nondet.exec_prompt(analysis_prompt, response_format="json")
            analysis = _parse_json(analysis_raw)
            
            query = analysis.get("query", situation)
            constraints = analysis.get("constraints", "None")

            # Step 2: Fetch product details via web search
            # We try DuckDuckGo HTML first, then fall back to DuckDuckGo Lite and API
            search_urls = [
                f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}",
                f"https://lite.duckduckgo.com/lite/?q={urllib.parse.quote(query)}",
                f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_html=1"
            ]
            
            res = None
            last_err = None
            for url in search_urls:
                try:
                    res = gl.nondet.web.get(url)
                    if res.status < 400:
                        break
                except Exception as e:
                    last_err = e
                    continue
            
            if res is None:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} Search failed due to network timeout or error: {str(last_err)}")
            if res.status >= 400 and res.status < 500:
                raise gl.vm.UserError(f"{ERROR_EXTERNAL} Search API returned HTTP {res.status}")
            elif res.status >= 500:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} Search API returned HTTP {res.status}")

            search_html = res.body.decode("utf-8", errors="ignore")
            # Strip excessive HTML tag bloat for LLM context optimization
            search_text = _clean_html(search_html)[:4000]

            # Step 3: Select product and reason about choice
            recommendation_prompt = f"""
            You are the AI Shopping Agent for Siggy Shopper.
            User Situation: "{situation}"
            Constraints: "{constraints}"
            Search Results:
            \"\"\"{search_text}\"\"\"

            Based on the situation and search results, choose the single best product recommendation.
            Output a JSON object exactly conforming to this structure:
            {{
              "product": "Name of the product",
              "image": "a valid product image URL from the search results, or a placeholder if none found",
              "price": "$price (estimate if not clear)",
              "store": "name of store (e.g., Amazon, Reebok, etc.)",
              "sizes": "available sizes mentioned, or N/A",
              "trendScore": a number from 0 to 100 representing popularity/relevance,
              "availability": "In Stock | Out of Stock",
              "whyChosen": "explain how this specifically matches the user's situation and constraints",
              "alternativeChoices": ["alternative product 1", "alternative product 2"],
              "confidence": a number from 0 to 100 representing confidence in match
            }}
            """
            recommendation_raw = gl.nondet.exec_prompt(recommendation_prompt, response_format="json")
            recommendation = _parse_json(recommendation_raw)
            
            # Defensive validation of required fields
            for field in ["product", "price", "store", "whyChosen"]:
                if field not in recommendation or not recommendation[field]:
                    raise gl.vm.UserError(f"{ERROR_LLM} Missing required recommendation field: {field}")

            return json.dumps(recommendation)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)

            try:
                leader_json = json.loads(leaders_res.value)
            except Exception:
                return False

            # Validators perform equivalence verification (Optimistic Democracy)
            # Instead of requiring the exact same product choice, we verify that the leader's product matches the intent.
            verification_prompt = f"""
            You are the verification agent for Siggy Shopper.
            A leader validator recommended the following product:
            Product: {leader_json.get("product")}
            Store: {leader_json.get("store")}
            Price: {leader_json.get("price")}
            Why Chosen: {leader_json.get("whyChosen")}

            Does this recommendation satisfy the user's situation and constraints?
            Situation: "{situation}"

            Evaluate constraints like size, category, and purpose.
            Return a JSON object exactly conforming to:
            {{
              "valid": true or false,
              "reason": "explanation of judgment"
            }}
            """
            verification_raw = gl.nondet.exec_prompt(verification_prompt, response_format="json")
            verification = _parse_json(verification_raw)

            return verification.get("valid", False)

        # Execute non-deterministic workflow and record the verified result
        final_recommendation = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.recommendations[request_id] = final_recommendation

    @gl.public.write
    def purchase_product(self, request_id: str) -> None:
        """
        Records the checkout confirmation of a product recommendation on-chain.
        """
        if self.recommendations.get(request_id, "") == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No recommendation found for request {request_id}")
        if self.purchases.get(request_id, False):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Product already purchased for request {request_id}")
            
        self.purchases[request_id] = True

    @gl.public.view
    def get_recommendation(self, request_id: str) -> str:
        """
        Returns the consensus recommendation details JSON.
        """
        return self.recommendations.get(request_id, "")

    @gl.public.view
    def is_purchased(self, request_id: str) -> bool:
        """
        Returns whether the product for this request has been purchased.
        """
        return self.purchases.get(request_id, False)

# Utility Functions

def _parse_json(raw) -> dict:
    """Helper to parse LLM json and remove potential markdown wrapping."""
    if isinstance(raw, dict):
        return raw
    text = str(raw).strip()
    # Remove markdown code block if present
    if text.startswith("```"):
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1:
            text = text[first:last + 1]
    # Sanitize trailing commas
    import re
    text = re.sub(r",(?!\s*?[\{\[\"\'\w])", "", text)
    try:
        return json.loads(text)
    except Exception as e:
        raise gl.vm.UserError(f"{ERROR_LLM} Failed to parse JSON: {str(e)}. Raw content: {raw}")

def _clean_html(html: str) -> str:
    """Basic HTML text extraction to reduce token context load."""
    import re
    # Remove script and style elements
    html = re.sub(r"<script.*?>.*?</script>", " ", html, flags=re.DOTALL)
    html = re.sub(r"<style.*?>.*?</style>", " ", html, flags=re.DOTALL)
    # Remove tags, keep text content
    text = re.sub(r"<.*?>", " ", html)
    # Replace multiple spaces/newlines with a single space
    text = re.sub(r"\s+", " ", text).strip()
    return text

def _handle_leader_error(leaders_res, leader_fn) -> bool:
    """Validates if leader and validator failed in agreement."""
    leader_msg = getattr(leaders_res, "message", "")
    try:
        leader_fn()
        return False  # Leader failed, but validator succeeded -> mismatch
    except gl.vm.UserError as e:
        val_msg = getattr(e, "message", str(e))
        if val_msg.startswith(ERROR_EXPECTED) or val_msg.startswith(ERROR_EXTERNAL):
            return val_msg == leader_msg
        if val_msg.startswith(ERROR_TRANSIENT) and leader_msg.startswith(ERROR_TRANSIENT):
            return True
        return False
    except Exception:
        return False