"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import '../app/landing.css';

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const [activeCard, setActiveCard] = useState(0);

  const swapCards = () => {
    setActiveCard((prev) => (prev === 0 ? 1 : 0));
  };

  useEffect(() => {
    // Reveal animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Demo cards animation
    const demoCards = document.querySelectorAll('.demo-page-card');
    const demoObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          demoCards.forEach(c => c.classList.add('visible'));
        }
      });
    }, { threshold: 0.2 });

    const firstDemoCard = document.querySelector('.demo-page-card');
    if (firstDemoCard) demoObserver.observe(firstDemoCard);

    // Nav scroll effect
    const handleScroll = () => {
      if (navRef.current) {
        if (window.scrollY > 60) {
          navRef.current.style.background = 'rgba(247,240,228,0.97)';
          navRef.current.style.boxShadow = '0 1px 0 rgba(44,26,14,0.08)';
        } else {
          navRef.current.style.background = 'linear-gradient(to bottom,rgba(247,240,228,.95),transparent)';
          navRef.current.style.boxShadow = 'none';
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      demoObserver.disconnect();
    };
  }, []);

  return (
    <div className="landing-body">
      <nav className="landing-nav" ref={navRef}>
        <div className="nav-logo">EchoBook</div>
        <div className="nav-links">
          <a href="#demo">How it works</a>
          <a href="#features-section">Features</a>
          <Link href="/app" className="nav-cta">Start Your Story</Link>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero">
        <div className="hero-left">
          <div className="hero-eyebrow"><span className="live-dot"></span>Powered by Gemini AI</div>
          <h1 className="landing-h1">Every memory<br/>deserves to<br/><em>live forever</em></h1>
          <p className="hero-sub">EchoBook listens to your stories and transforms them into a beautifully illustrated life memoir — one page at a time, as you speak.</p>
          <div className="hero-actions">
            <Link href="/app" className="btn-primary-landing">Begin Your Book</Link>
            <a href="#demo" className="btn-ghost-landing">See How It Works</a>
          </div>
          <div className="hero-quote reveal reveal-delay-3">
            <p>She hadn't spoken about her childhood in years. Now she can't stop.</p>
            <cite>— Linda, using EchoBook for her mother</cite>
          </div>
        </div>
        <div className="hero-right">
          <div className="book-preview deck-container" onClick={swapCards}>
            {/* Card 1 */}
            <div className={`book-card-landing reveal ${activeCard === 0 ? 'top' : 'bottom'}`}>
              <div className="card-image-landing">
                <div className="card-image-inner-landing">
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="100%" height="100%" viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E8D5A8" />
                          <stop offset="100%" stopColor="#C9973A22" />
                        </linearGradient>
                      </defs>
                      <rect width="500" height="240" fill="url(#sky)" />
                      <circle cx="380" cy="60" r="45" fill="#E8C97A" opacity=".4" />
                      <ellipse cx="250" cy="200" rx="200" ry="60" fill="#8B6B5A" opacity=".08" />
                      <rect x="60" y="120" width="80" height="90" rx="2" fill="#5C3D2E" opacity=".15" />
                      <rect x="70" y="80" width="60" height="50" rx="1" fill="#5C3D2E" opacity=".1" />
                      <ellipse cx="200" cy="140" rx="50" ry="65" fill="#6E8B74" opacity=".2" />
                      <ellipse cx="340" cy="150" rx="40" ry="55" fill="#6E8B74" opacity=".15" />
                      <path d="M0 180 Q125 160 250 175 Q375 190 500 170 L500 240 L0 240Z" fill="#8B6B5A" opacity=".12" />
                      <circle cx="150" cy="190" r="3" fill="#C9973A" opacity=".5" />
                      <circle cx="320" cy="185" r="2" fill="#C9973A" opacity=".4" />
                      <circle cx="420" cy="195" r="2.5" fill="#C9973A" opacity=".3" />
                    </svg>
                  </div>
                  <div className="card-image-overlay-landing"></div>
                </div>
              </div>
              <div className="card-body-landing">
                <div className="card-meta-landing">
                  <span className="card-tag-landing">Childhood</span>
                  <span className="card-era-landing">1960s</span>
                </div>
                <p className="card-narration-landing">I remember the smell of rain on dry earth, the way my grandmother's kitchen filled with the sound of sizzling mustard seeds — <span>that warmth that meant home.</span></p>
                <div className="card-people-landing">
                  <span className="person-chip-landing">grandmother</span>
                  <span className="person-chip-landing">family</span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className={`book-card-landing reveal reveal-delay-1 ${activeCard === 1 ? 'top' : 'bottom'}`}>
              <div className="card-image-landing">
                <div className="card-image-inner-landing" style={{ background: 'linear-gradient(135deg, #7A9E7E 0%, #EFE5CC 100%)' }}>
                  <div style={{ fontSize: '4rem', opacity: 0.2 }}>✨</div>
                </div>
              </div>
              <div className="card-body-landing">
                <div className="card-meta-landing">
                  <span className="card-tag-landing">Love</span>
                  <span className="card-era-landing">1975</span>
                </div>
                <p className="card-narration-landing">The evening we first danced under the stars, the air smelled of jasmine and new beginnings. Some moments never leave you.<span>It was magic.</span></p>
                <div className="card-people-landing">
                  <span className="person-chip-landing">first love</span>
                  <span className="person-chip-landing">dance</span>
                </div>
              </div>
            </div>

          </div>
        </div>
        <div className="scroll-hint">
          <span>Scroll</span>
          <div className="scroll-line"></div>
        </div>
      </section>

      {/* DEMO / HOW IT WORKS */}
      <section id="demo" className="landing-section">
        <div className="demo-inner">
          <div className="demo-text reveal">
            <div className="section-eyebrow">The Magic</div>
            <h2 className="section-title">A memory spoken.<br/><em>A page born.</em></h2>
            <p className="section-sub">EchoBook asks gentle, curious questions. As the story deepens, it weaves the memory into a beautifully written passage and generates a watercolor illustration — all in real time.</p>
            <div className="demo-memory" style={{ marginTop: '36px' }}>
              <div className="demo-memory-label">You say</div>
              <p className="demo-memory-text">"We had mango trees in the backyard. Every summer my grandfather would lift me onto the lowest branch so I could reach the ripest ones…"</p>
            </div>
            <div className="demo-arrow">EchoBook listens & illustrates</div>
            <div className="demo-result">
              <div className="demo-result-label">Your book receives</div>
              <p className="demo-result-text">"In the golden summers of my childhood, grandfather's steady hands would lift me toward the sky, where the ripest mangoes hung like small suns waiting to be discovered."</p>
            </div>
          </div>
          <div className="demo-pages">
            <div className="demo-page-card">
              <div className="dpc-image">🌿</div>
              <div className="dpc-content">
                <div className="dpc-chapter">Childhood</div>
                <p className="dpc-narration">"The mango trees stood like guardians over our small courtyard…"</p>
                <div className="dpc-era">1960s · joy</div>
              </div>
            </div>
            <div className="demo-page-card">
              <div className="dpc-image">🌧</div>
              <div className="dpc-content">
                <div className="dpc-chapter">Family</div>
                <p className="dpc-narration">"Every monsoon, grandmother's kitchen became the heart of the house…"</p>
                <div className="dpc-era">1965 · nostalgia</div>
              </div>
            </div>
            <div className="demo-page-card">
              <div className="dpc-image">✨</div>
              <div className="dpc-content">
                <div className="dpc-chapter">Work</div>
                <p className="dpc-narration">"The day the fields turned green again, something shifted inside me…"</p>
                <div className="dpc-era">1978 · pride</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS STEPS */}
      <section id="how-section" className="landing-section">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }} className="reveal">
            <div className="section-eyebrow" style={{ justifyContent: 'center' }}>The Process</div>
            <h2 className="section-title" style={{ fontSize: '2.8rem' }}>Simple as telling a story</h2>
          </div>
          <div className="steps">
            <div className="step reveal">
              <div className="step-number">
                <span className="step-number-inner">I</span>
                <span className="step-icon">🎙</span>
              </div>
              <h3 className="step-title">Speak freely</h3>
              <p className="step-desc">Use voice or text. EchoBook listens with patience and warmth, asking gentle questions to draw out richer details.</p>
            </div>
            <div className="step reveal reveal-delay-1">
              <div className="step-number">
                <span className="step-number-inner">II</span>
                <span className="step-icon">✦</span>
              </div>
              <h3 className="step-title">AI weaves the story</h3>
              <p className="step-desc">Gemini AI transforms your words into beautifully written memoir narration and generates a matching watercolor illustration.</p>
            </div>
            <div className="step reveal reveal-delay-2">
              <div className="step-number">
                <span className="step-number-inner">III</span>
                <span className="step-icon">📖</span>
              </div>
              <h3 className="step-title">Your book grows</h3>
              <p className="step-desc">Every memory becomes a page. Return across sessions — your book remembers everything and continues right where you left off.</p>
            </div>
          </div>
        </div>
      </section>

      {/* EMOTIONAL SECTION */}
      <section id="emotion">
        <span className="emotion-ornament">✦</span>
        <blockquote className="emotion-quote reveal">"Memories fade.<br/><em>Stories shouldn't.</em>"</blockquote>
        <p className="emotion-sub reveal reveal-delay-1">800 million people over 65 carry a lifetime of irreplaceable stories. Most will never be written down. EchoBook changes that.</p>
        <Link href="/app" className="emotion-cta reveal reveal-delay-2">Preserve a story today</Link>
      </section>

      {/* FEATURES */}
      <section id="features-section" className="landing-section">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="reveal">
            <div className="section-eyebrow">What EchoBook Does</div>
            <h2 className="section-title">Built for <em>real stories</em></h2>
          </div>
          <div className="features-grid" style={{ marginTop: '48px' }}>
            <div className="feature reveal">
              <div className="feature-icon">🎙</div>
              <h3 className="feature-title">Voice & text interview</h3>
              <p className="feature-desc">Speak naturally or type. The AI companion asks follow-up questions that draw out the richest details from each memory.</p>
            </div>
            <div className="feature reveal reveal-delay-1">
              <div className="feature-icon">🎨</div>
              <h3 className="feature-title">Live illustration</h3>
              <p className="feature-desc">Every page gets a unique watercolor illustration generated in real time — painted as the memory is spoken.</p>
            </div>
            <div className="feature reveal reveal-delay-2">
              <div className="feature-icon">📚</div>
              <h3 className="feature-title">Persistent memory</h3>
              <p className="feature-desc">Sessions are saved to your personal book. Return days later and continue exactly where you left off — your story is never lost.</p>
            </div>
            <div className="feature reveal">
              <div className="feature-icon">✍</div>
              <h3 className="feature-title">Memoir narration</h3>
              <p className="feature-desc">Your words are transformed into first-person memoir prose — warm, personal, and written in your own voice.</p>
            </div>
            <div className="feature reveal reveal-delay-1">
              <div className="feature-icon">🏷</div>
              <h3 className="feature-title">Smart tagging</h3>
              <p className="feature-desc">Each page is automatically tagged with era, emotion, chapter, and key people — making your book searchable and organized.</p>
            </div>
            <div className="feature reveal reveal-delay-2">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Private & secure</h3>
              <p className="feature-desc">Your memories belong to you. Stored securely with Google Firestore, accessible only through your personal account.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section id="testimonial">
        <div className="testimonial-inner reveal">
          <blockquote className="testimonial-quote">My mother spoke for three hours. She remembered things she hadn't thought about in fifty years. EchoBook gave us something I can't put a price on.</blockquote>
          <div className="testimonial-person">
            <div className="testimonial-avatar">👩</div>
            <div>
              <div className="testimonial-name">Linda Fernandes</div>
              <div className="testimonial-role">Daughter, using EchoBook for her mother Eleanor, 81</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="cta-section">
        <span className="cta-ornament">📖</span>
        <h2 className="cta-title-landing reveal">Their stories are<br/><em>waiting to be told</em></h2>
        <p className="cta-sub reveal reveal-delay-1">Start a session today. In one conversation, you'll have the first pages of a book that will last a lifetime.</p>
        <div className="cta-actions reveal reveal-delay-2">
          <Link href="/app" className="btn-primary-landing" style={{ fontSize: '1.05rem', padding: '18px 52px' }}>Begin the Book</Link>
        </div>
        <p style={{ marginTop: '28px', fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: '.75rem', color: 'var(--ink-soft)', opacity: .4, letterSpacing: '.06em' }}>FREE · POWERED BY GEMINI AI · NO CREDIT CARD NEEDED</p>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div>
          <div className="footer-logo">EchoBook</div>
          <div className="footer-badge" style={{ marginTop: '6px' }}>Made with Gemini AI · Built for the Gemini Live Agent Challenge</div>
        </div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">About</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  );
}
