// Presentation Layer: Interactive Medical slide deck viewer, fullscreen controller, and export generator.

class DeckRenderer {
  constructor(slideContainerId, prevBtnId, nextBtnId, indicatorId, fullscreenBtnId) {
    this.container = document.getElementById(slideContainerId);
    this.prevBtn = document.getElementById(prevBtnId);
    this.nextBtn = document.getElementById(nextBtnId);
    this.indicator = document.getElementById(indicatorId);
    this.fullscreenBtn = document.getElementById(fullscreenBtnId);

    this.slides = [];
    this.currentSlideIndex = 0;
    this.isFullscreen = false;
    
    this.setupListeners();
  }

  // Setup click listeners
  setupListeners() {
    if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prevSlide());
    if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.nextSlide());
    if (this.fullscreenBtn) this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    
    // Key bindings for slider nav
    document.addEventListener('keydown', (e) => {
      if (this.slides.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        this.nextSlide();
      } else if (e.key === 'ArrowLeft') {
        this.prevSlide();
      } else if (e.key === 'Escape' && this.isFullscreen) {
        this.exitFullscreen();
      }
    });
  }

  // Renders the deck state from JSON
  render(data) {
    this.slides = data.slides || [];
    this.currentSlideIndex = 0;
    this.updateUI();
  }

  // Go to previous slide
  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.updateUI();
    }
  }

  // Go to next slide
  nextSlide() {
    if (this.currentSlideIndex < this.slides.length - 1) {
      this.currentSlideIndex++;
      this.updateUI();
    }
  }

  // Update UI DOM based on active slide index
  updateUI() {
    if (!this.container || this.slides.length === 0) {
      if (this.container) {
        this.container.innerHTML = `<div class="viewer-placeholder"><i class="viewer-placeholder-icon">📊</i><p>No presentation deck generated yet.</p></div>`;
      }
      if (this.indicator) this.indicator.textContent = 'Slide 0 of 0';
      return;
    }

    this.container.innerHTML = '';
    
    this.slides.forEach((slide, idx) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = `deck-slide ${idx === this.currentSlideIndex ? 'active' : ''}`;
      
      const bullets = slide.bulletPoints.map(point => `<li>${this.boldKeywords(point)}</li>`).join('');
      
      slideDiv.innerHTML = `
        <span class="slide-category">${slide.category}</span>
        <h2 class="slide-title">${slide.title}</h2>
        <div class="slide-content">
          <ul>${bullets}</ul>
        </div>
      `;
      this.container.appendChild(slideDiv);
    });

    if (this.indicator) {
      this.indicator.textContent = `Slide ${this.currentSlideIndex + 1} of ${this.slides.length}`;
    }

    // Toggle button disabled state
    if (this.prevBtn) this.prevBtn.disabled = this.currentSlideIndex === 0;
    if (this.nextBtn) this.nextBtn.disabled = this.currentSlideIndex === this.slides.length - 1;
  }

  // Highlight medical terminology in bullet points
  boldKeywords(text) {
    const keywords = [
      'VEGF', 'Aflibercept', 'Eylea', 'PRP', 'panretinal', 'photocoagulation', 
      'amyloid', 'monoclonal', 'plaque', 'tau', 'CSF', 'ARIA', 'MRI', 'diabetic', 
      'retinopathy', 'macular', 'edema', 'visual', 'acuity', 'CST', 'HbA1c', 
      'Lisnopril', 'Atorvastatin', 'neovascularization', 'glaucoma'
    ];
    let formattedText = text;
    keywords.forEach(word => {
      const regex = new RegExp(`\\b(${word})\\b`, 'gi');
      formattedText = formattedText.replace(regex, '<strong>$1</strong>');
    });
    return formattedText;
  }

  // Fullscreen presentation view handler
  toggleFullscreen() {
    if (this.slides.length === 0) return;
    
    const workspaceElement = document.getElementById('deck-workspace');
    if (!workspaceElement) return;

    if (!this.isFullscreen) {
      this.isFullscreen = true;
      workspaceElement.classList.add('fullscreen-deck');
      
      // Add Escape key instructions
      const infoSpan = document.createElement('span');
      infoSpan.id = 'fullscreen-info';
      infoSpan.style.position = 'absolute';
      infoSpan.style.bottom = '20px';
      infoSpan.style.left = '50%';
      infoSpan.style.transform = 'translateX(-50%)';
      infoSpan.style.color = '#6b7280';
      infoSpan.style.fontSize = '12px';
      infoSpan.textContent = 'Press ESC to exit fullscreen • Use Left/Right Arrow or Spacebar to navigate';
      workspaceElement.appendChild(infoSpan);
      
      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.id = 'fullscreen-close';
      closeBtn.className = 'fullscreen-close';
      closeBtn.innerHTML = '×';
      closeBtn.onclick = () => this.exitFullscreen();
      workspaceElement.appendChild(closeBtn);
    } else {
      this.exitFullscreen();
    }
  }

  exitFullscreen() {
    const workspaceElement = document.getElementById('deck-workspace');
    if (!workspaceElement) return;

    this.isFullscreen = false;
    workspaceElement.classList.remove('fullscreen-deck');
    
    const infoSpan = document.getElementById('fullscreen-info');
    if (infoSpan) infoSpan.remove();
    
    const closeBtn = document.getElementById('fullscreen-close');
    if (closeBtn) closeBtn.remove();
  }

  // Export clinical slide presentation to a fully styled standalone HTML file
  exportHtmlDeck() {
    if (this.slides.length === 0) return;
    
    const slidesJson = JSON.stringify(this.slides);
    
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clinical Summary Presentation - HealTab LLM</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body {
      background: linear-gradient(135deg, #090d16 0%, #1e1b4b 100%);
      color: #f3f4f6;
      font-family: 'Outfit', sans-serif;
      margin: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .presentation-card {
      width: 90vw;
      max-width: 900px;
      aspect-ratio: 16 / 9;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 50px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .slide {
      display: none;
      animation: fadeIn 0.5s forwards;
    }
    .slide.active {
      display: flex;
      flex-direction: column;
    }
    .slide-tag {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #00f2fe;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .slide-title {
      font-size: 36px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .slide-body ul {
      padding-left: 20px;
    }
    .slide-body li {
      font-size: 18px;
      line-height: 1.6;
      margin-bottom: 12px;
      color: #9ca3af;
    }
    .slide-body strong {
      color: #00f2fe;
    }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 90vw;
      max-width: 900px;
      margin-top: 20px;
    }
    button {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      transition: all 0.3s;
    }
    button:hover {
      border-color: #00f2fe;
      background: rgba(0, 242, 254, 0.05);
    }
    button:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .progress {
      font-size: 16px;
      color: #9ca3af;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="presentation-card">
    <div id="slides-container"></div>
  </div>
  <div class="controls">
    <button id="prev" onclick="changeSlide(-1)">Previous</button>
    <div id="progress" class="progress">Slide 1 of 5</div>
    <button id="next" onclick="changeSlide(1)">Next</button>
  </div>

  <script>
    const slides = ${slidesJson};
    let currentIdx = 0;

    function renderSlides() {
      const container = document.getElementById('slides-container');
      container.innerHTML = '';
      slides.forEach((s, idx) => {
        const slideDiv = document.createElement('div');
        slideDiv.className = 'slide' + (idx === currentIdx ? ' active' : '');
        
        const bullets = s.bulletPoints.map(b => '<li>' + b + '</li>').join('');
        slideDiv.innerHTML = 
          '<div class="slide-tag">' + s.category + '</div>' +
          '<h2 class="slide-title">' + s.title + '</h2>' +
          '<div class="slide-body"><ul>' + bullets + '</ul></div>';
        
        container.appendChild(slideDiv);
      });
      
      document.getElementById('progress').textContent = 'Slide ' + (currentIdx + 1) + ' of ' + slides.length;
      document.getElementById('prev').disabled = currentIdx === 0;
      document.getElementById('next').disabled = currentIdx === slides.length - 1;
    }

    function changeSlide(direction) {
      currentIdx += direction;
      renderSlides();
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (currentIdx < slides.length - 1) changeSlide(1);
      } else if (e.key === 'ArrowLeft') {
        if (currentIdx > 0) changeSlide(-1);
      }
    });

    renderSlides();
  </script>
</body>
</html>`;

    // Download file locally using Blob
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Clinical_Presentation_${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// Export class globally
window.DeckRenderer = DeckRenderer;
