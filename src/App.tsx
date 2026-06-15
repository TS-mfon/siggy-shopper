import React, { useState, useEffect, useRef } from 'react';
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';
import { 
  Sparkles, 
  ShoppingBag, 
  CheckCircle, 
  Search, 
  ArrowRight, 
  Loader2, 
  Check, 
  History, 
  AlertCircle, 
  ShoppingCart, 
  ChevronRight
} from 'lucide-react';
import contractConfig from './contract-address.json';
import './App.css';

// Declare the global VITE_PRIVATE_KEY defined in vite.config.ts
declare const __VITE_PRIVATE_KEY__: string;

interface Recommendation {
  product: string;
  image?: string;
  price: string;
  store: string;
  sizes?: string;
  trendScore?: number;
  availability?: string;
  whyChosen: string;
  alternativeChoices?: string[];
  confidence?: number;
}

interface HistoryItem {
  id: string;
  situation: string;
  recommendation: Recommendation | null;
  purchased: boolean;
  timestamp: number;
}

const QUICK_EXAMPLES = [
  "I'm looking for a premium lightweight sunscreen for sensitive skin, budget under $30.",
  "Need a mechanical keyboard with quiet switches for office coding under $120.",
  "Looking for trendy and comfortable running sneakers, size 45, under $150.",
  "What is a highly-rated organic coffee bean with chocolate notes for espresso?"
];

function App() {
  // Config & Wallet States
  const [privateKey] = useState<string>(() => {
    const saved = localStorage.getItem('siggy_private_key');
    if (saved) return saved;
    try {
      if (typeof __VITE_PRIVATE_KEY__ !== 'undefined' && __VITE_PRIVATE_KEY__) {
        return __VITE_PRIVATE_KEY__;
      }
    } catch (e) {}
    
    // Auto-generate one secretly
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const hex = '0x' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return hex;
  });

  const [accountAddress, setAccountAddress] = useState<string>('');
  const [client, setClient] = useState<any>(null);

  // Form & Process States
  const [situation, setSituation] = useState('');
  const [requestId, setRequestId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  
  // Real-time Transaction Status Tracker
  // Steps: 0: Idle, 1: Submitting, 2: Intent Analysis & Search, 3: Choosing Product, 4: Equivalence Validation, 5: Consensus Reached
  const [statusStep, setStatusStep] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Result States
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isPurchased, setIsPurchased] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showShoppingSites, setShowShoppingSites] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('siggy_history');
    return saved ? JSON.parse(saved) : [];
  });

  const pollIntervalRef = useRef<any>(null);

  // Setup GenLayer Client whenever privateKey changes
  useEffect(() => {
    if (!privateKey || !privateKey.trim().startsWith('0x') || privateKey.trim().length !== 66) {
      setAccountAddress('');
      setClient(null);
      return;
    }
    
    try {
      const cleanKey = privateKey.trim();
      const account = createAccount(cleanKey as `0x${string}`);
      setAccountAddress(account.address);
      
      const glClient = createClient({
        chain: studionet,
        account: account,
      });
      setClient(glClient);
      localStorage.setItem('siggy_private_key', cleanKey);
    } catch (e: any) {
      console.error("Failed to initialize GenLayer client:", e);
      setErrorMessage("Invalid Private Key format");
    }
  }, [privateKey]);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('siggy_history', JSON.stringify(history));
  }, [history]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);



  const startTransactionPolling = (hash: string, reqId: string, currentSituation: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    let retriesCount = 0;
    const maxRetries = 100; // 100 * 5s = 500s = ~8.3 mins max
    
    pollIntervalRef.current = setInterval(async () => {
      if (!client) return;
      retriesCount++;
      
      try {
        const tx = await client.getTransaction({ hash });
        if (!tx) return;
        
        const statusNum = Number(tx.status);
        
        // Match GenLayer-JS transaction status codes:
        // PENDING (1), PROPOSING (2), COMMITTING (3), REVEALING (4), ACCEPTED (5), FINALIZED (7)
        if (statusNum === 1) {
          setStatusStep(1);
          setStatusText("Transaction submitted. Waiting in mempool...");
        } else if (statusNum === 2) {
          setStatusStep(2);
          setStatusText("Analyzing situation & crawling the web for product listings...");
        } else if (statusNum === 3) {
          setStatusStep(3);
          setStatusText("Evaluating choices & selecting the absolute best match...");
        } else if (statusNum === 4) {
          setStatusStep(4);
          setStatusText("Running Equivalence Validation across validators...");
        } else if (statusNum === 5 || statusNum === 7) {
          setStatusStep(5);
          setStatusText("Consensus reached! Decoding recommendation...");
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          
          // Fetch recommendation state
          await fetchRecommendationResult(reqId, currentSituation);
        } else if (statusNum === 8 || statusNum === 6) { // Canceled or Undetermined
          setErrorMessage(`Transaction ended with status: ${tx.statusName || statusNum}`);
          setIsSubmitting(false);
          setStatusStep(0);
          clearInterval(pollIntervalRef.current);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
      }
      
      if (retriesCount >= maxRetries) {
        setErrorMessage("Transaction polling timed out. Consensus is taking longer than expected.");
        setIsSubmitting(false);
        setStatusStep(0);
        clearInterval(pollIntervalRef.current);
      }
    }, 5000);
  };

  const fetchRecommendationResult = async (reqId: string, currentSituation: string) => {
    if (!client) return;
    
    try {
      const result = await client.readContract({
        address: contractConfig.address as `0x${string}`,
        functionName: 'get_recommendation',
        args: [reqId],
        transactionHashVariant: 'latest-nonfinal',
      });
      
      if (!result) {
        throw new Error("No recommendation data returned from contract state");
      }
      
      const parsed: Recommendation = JSON.parse(result);
      setRecommendation(parsed);
      setIsPurchased(false);
      
      // Update history with recommendation details
      setHistory(prev => {
        const itemIndex = prev.findIndex(item => item.id === reqId);
        if (itemIndex > -1) {
          const updated = [...prev];
          updated[itemIndex] = {
            ...updated[itemIndex],
            recommendation: parsed,
          };
          return updated;
        } else {
          return [
            {
              id: reqId,
              situation: currentSituation,
              recommendation: parsed,
              purchased: false,
              timestamp: Date.now(),
            },
            ...prev
          ];
        }
      });
      
      setIsSubmitting(false);
    } catch (err: any) {
      console.error("Failed to read recommendation:", err);
      setErrorMessage(`Failed to retrieve recommendation: ${err.message || err}`);
      setIsSubmitting(false);
    }
  };

  const handleRequestRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !situation.trim()) return;
    
    setIsSubmitting(true);
    setErrorMessage('');
    setRecommendation(null);
    setIsPurchased(false);
    setShowShoppingSites(false);
    
    const reqId = "req_" + Math.random().toString(36).substring(2, 9);
    setRequestId(reqId);
    setStatusStep(1);
    setStatusText("Signing & sending transaction to GenLayer...");
    
    // Optimistically add empty item to history
    setHistory(prev => [
      {
        id: reqId,
        situation: situation.trim(),
        recommendation: null,
        purchased: false,
        timestamp: Date.now(),
      },
      ...prev
    ]);

    try {
      const hash = await client.writeContract({
        address: contractConfig.address as `0x${string}`,
        functionName: 'request_recommendation',
        args: [reqId, situation.trim()],
      });
      
      setTxHash(hash);
      startTransactionPolling(hash, reqId, situation.trim());
    } catch (err: any) {
      console.error("Write contract error:", err);
      setErrorMessage(err.message || "Failed to submit transaction to the blockchain.");
      setIsSubmitting(false);
      setStatusStep(0);
      
      // Remove failed item from history
      setHistory(prev => prev.filter(item => item.id !== reqId));
    }
  };

  const handlePurchase = async () => {
    if (!client || !requestId || !recommendation) return;
    
    setIsPurchasing(true);
    setErrorMessage('');
    
    try {
      const purchaseTx = await client.writeContract({
        address: contractConfig.address as `0x${string}`,
        functionName: 'purchase_product',
        args: [requestId],
      });
      
      // Wait for purchase transaction with 2-minute timeout
      await client.waitForTransactionReceipt({
        hash: purchaseTx,
        status: TransactionStatus.ACCEPTED,
        retries: 24,
        interval: 5000,
      });
      
      setIsPurchased(true);
      
      // Update history purchase status
      setHistory(prev => prev.map(item => {
        if (item.id === requestId) {
          return { ...item, purchased: true };
        }
        return item;
      }));
    } catch (err: any) {
      console.error("Purchase error:", err);
      setErrorMessage(err.message || "Purchase confirmation failed");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleShop = () => {
    setShowShoppingSites(true);
    if (!isPurchased && !isPurchasing) {
      handlePurchase();
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setRequestId(item.id);
    setSituation(item.situation);
    setRecommendation(item.recommendation);
    setIsPurchased(item.purchased);
    setErrorMessage('');
    setIsSubmitting(false);
    setStatusStep(0);
    setShowShoppingSites(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('siggy_history');
  };

  const isWalletConnected = !!accountAddress;

  return (
    <div className="app-container">
      {/* Top Glass Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">
            <Sparkles className="logo-spark" />
            <ShoppingBag className="logo-bag" />
          </div>
          <div className="brand-text">
            <h1>Siggy Shopper</h1>
            <p>Decentralized AI shopping consensus assistant</p>
          </div>
        </div>

        <div className="wallet-pill">
          <div className="status-indicator online"></div>
          <span className="address-display">Consensus Node Connected</span>
        </div>
      </header>

      <main className="app-main">
        {/* Left Control Panel */}
        <section className="control-panel">

          {/* History Widget */}
          <div className="glass-card history-manager">
            <div className="history-header">
              <h2>
                <History className="panel-icon" /> Recent Queries
              </h2>
              {history.length > 0 && (
                <button className="clear-btn" onClick={clearHistory}>
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="empty-history">
                <p>No queries made yet. Start describing a shopping request!</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    className={`history-item ${requestId === item.id ? 'active' : ''}`}
                    onClick={() => loadHistoryItem(item)}
                  >
                    <div className="history-item-top">
                      <span className="history-id">#{item.id.slice(-5)}</span>
                      {item.purchased ? (
                        <span className="status-badge purchased">Purchased</span>
                      ) : item.recommendation ? (
                        <span className="status-badge resolved">Resolved</span>
                      ) : (
                        <span className="status-badge pending">Processing</span>
                      )}
                    </div>
                    <p className="history-situation">{item.situation}</p>
                    {item.recommendation && (
                      <div className="history-recommendation">
                        <ChevronRight size={14} />
                        <span className="rec-name">{item.recommendation.product}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Search Area / Results */}
        <section className="search-display-panel">
          {/* Query Box */}
          <div className="glass-card search-card">
            <h2>
              <Search className="panel-icon" /> What are you looking to buy?
            </h2>
            <p className="card-desc text-left">
              Type your requirements, skin conditions, sizes, budget, and brand constraints. Our decentralized LLM equivalence consensus model will evaluate web listings and propose the single best matched product.
            </p>

            <form onSubmit={handleRequestRecommendation} className="search-form">
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="E.g., I'm looking for a hydration face moisturizer with hyaluronic acid for dry skin, budget under $40..."
                rows={3}
                required
                disabled={isSubmitting || !isWalletConnected}
              />
              
              <div className="form-footer">
                <div className="quick-labels">
                  <span className="label-title">Suggestions:</span>
                  <div className="label-items">
                    {QUICK_EXAMPLES.map((ex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="quick-label-btn"
                        onClick={() => setSituation(ex)}
                        disabled={isSubmitting || !isWalletConnected}
                      >
                        {ex.slice(0, 32)}...
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting || !isWalletConnected || !situation.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="spinner" /> Analyzing consensus...
                    </>
                  ) : (
                    <>
                      Request AI Consensus <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {!isWalletConnected && (
              <div className="warning-overlay">
                <AlertCircle size={24} />
                <h3>Wallet Connection Required</h3>
                <p>Please provide a Studionet private key in the Connection Manager to query recommendations.</p>
              </div>
            )}
          </div>

          {/* Stepper Logic for Consensus */}
          {isSubmitting && (
            <div className="glass-card stepper-card">
              <div className="stepper-title">
                <h2>Consensus Execution Pipeline</h2>
                <span className="tx-hash-badge" title={txHash}>
                  Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </span>
              </div>
              <p className="stepper-desc">{statusText}</p>

              <div className="stepper-visual">
                <div className={`step-node ${statusStep >= 1 ? 'completed' : ''} ${statusStep === 1 ? 'active' : ''}`}>
                  <div className="node-icon">
                    {statusStep > 1 ? <Check size={16} /> : <span>1</span>}
                  </div>
                  <span className="node-label">Signed Transaction</span>
                </div>
                <div className="step-connector"></div>
                
                <div className={`step-node ${statusStep >= 2 ? 'completed' : ''} ${statusStep === 2 ? 'active' : ''}`}>
                  <div className="node-icon">
                    {statusStep > 2 ? <Check size={16} /> : statusStep === 2 ? <Loader2 className="spinner" size={16} /> : <span>2</span>}
                  </div>
                  <span className="node-label">Web Search Crawler</span>
                </div>
                <div className="step-connector"></div>

                <div className={`step-node ${statusStep >= 3 ? 'completed' : ''} ${statusStep === 3 ? 'active' : ''}`}>
                  <div className="node-icon">
                    {statusStep > 3 ? <Check size={16} /> : statusStep === 3 ? <Loader2 className="spinner" size={16} /> : <span>3</span>}
                  </div>
                  <span className="node-label">AI Product Selection</span>
                </div>
                <div className="step-connector"></div>

                <div className={`step-node ${statusStep >= 4 ? 'completed' : ''} ${statusStep === 4 ? 'active' : ''}`}>
                  <div className="node-icon">
                    {statusStep > 4 ? <Check size={16} /> : statusStep === 4 ? <Loader2 className="spinner" size={16} /> : <span>4</span>}
                  </div>
                  <span className="node-label">Equivalence Validation</span>
                </div>
                <div className="step-connector"></div>

                <div className={`step-node ${statusStep >= 5 ? 'completed' : ''} ${statusStep === 5 ? 'active' : ''}`}>
                  <div className="node-icon">
                    {statusStep >= 5 ? <Check size={16} /> : <span>5</span>}
                  </div>
                  <span className="node-label">Consensus Confirmed</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="error-banner card-margin">
              <AlertCircle className="err-icon" />
              <div className="err-content">
                <h3>Transaction Execution Encountered an Issue</h3>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Recommendation Results Display */}
          {recommendation && (
            <div className="glass-card recommendation-card">
              <div className="rec-header">
                <div className="rec-badge">
                  <CheckCircle size={14} /> AI Consensual Pick
                </div>
                {recommendation.trendScore && (
                  <div className="trend-badge">
                    Trend Score: {recommendation.trendScore}/100
                  </div>
                )}
              </div>

              <div className="rec-grid">
                <div className="rec-visuals">
                  {recommendation.image && recommendation.image.startsWith('http') ? (
                    <img 
                      className="product-image" 
                      src={recommendation.image} 
                      alt={recommendation.product} 
                      onError={(e) => {
                        // Hide image or fall back to icon if image fails to load
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="product-image-fallback">
                      <ShoppingBag size={48} className="fallback-icon" />
                    </div>
                  )}
                  
                  <div className="meta-info">
                    <div className="meta-item">
                      <span className="meta-label">Est. Price</span>
                      <span className="meta-value">{recommendation.price}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Merchant</span>
                      <span className="meta-value">{recommendation.store}</span>
                    </div>
                    {recommendation.sizes && (
                      <div className="meta-item">
                        <span className="meta-label">Available Sizes</span>
                        <span className="meta-value">{recommendation.sizes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rec-details">
                  <h2 className="product-title">{recommendation.product}</h2>
                  <span className={`stock-badge ${recommendation.availability === 'In Stock' ? 'instock' : 'outofstock'}`}>
                    {recommendation.availability || 'Available'}
                  </span>

                  <div className="why-section">
                    <h3>Why Recommended</h3>
                    <blockquote>
                      "{recommendation.whyChosen}"
                    </blockquote>
                  </div>

                  {recommendation.alternativeChoices && recommendation.alternativeChoices.length > 0 && (
                    <div className="alternatives-section">
                      <h3>Considered Alternatives</h3>
                      <ul>
                        {recommendation.alternativeChoices.map((alt, i) => (
                          <li key={i}>{alt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recommendation.confidence !== undefined && (
                    <div className="confidence-section">
                      <div className="conf-label-row">
                        <span>Consensus Confidence Match:</span>
                        <strong>{recommendation.confidence}%</strong>
                      </div>
                      <div className="conf-bar-wrapper">
                        <div 
                          className="conf-bar" 
                          style={{ width: `${recommendation.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="rec-actions">
                    <button 
                      className="btn btn-primary btn-purchase"
                      onClick={handleShop}
                      disabled={isPurchasing}
                    >
                      {isPurchasing ? (
                        <>
                          <Loader2 className="spinner" /> Connecting to merchant...
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={18} /> Shop
                        </>
                      )}
                    </button>

                    {showShoppingSites && (
                      <div className="shopping-sites-list margin-t animate-slide-down" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <h4 style={{ margin: '8px 0', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Available Purchase Links:
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <a 
                            href={
                              recommendation.store.toLowerCase().includes('amazon') 
                                ? `https://www.amazon.com/s?k=${encodeURIComponent(recommendation.product)}` 
                                : `https://www.google.com/search?q=${encodeURIComponent(recommendation.product)}+${encodeURIComponent(recommendation.store)}`
                            }
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-secondary btn-full"
                            style={{ justifyContent: 'space-between', padding: '10px 16px', fontSize: '13.5px' }}
                          >
                            <span>Buy on {recommendation.store}</span>
                            <ChevronRight size={16} />
                          </a>

                          <a 
                            href={`https://www.amazon.com/s?k=${encodeURIComponent(recommendation.product)}`}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-secondary btn-full"
                            style={{ justifyContent: 'space-between', padding: '10px 16px', fontSize: '13.5px' }}
                          >
                            <span>Search on Amazon</span>
                            <ChevronRight size={16} />
                          </a>

                          <a 
                            href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(recommendation.product)}`}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-secondary btn-full"
                            style={{ justifyContent: 'space-between', padding: '10px 16px', fontSize: '13.5px' }}
                          >
                            <span>Compare on Google Shopping</span>
                            <ChevronRight size={16} />
                          </a>
                        </div>
                      </div>
                    )}

                    {isPurchased && (
                      <div className="purchase-success" style={{ marginTop: '12px', padding: '8px 12px', fontSize: '12px' }}>
                        <CheckCircle size={14} />
                        <span>Registered on GenLayer Consensus Ledger</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
