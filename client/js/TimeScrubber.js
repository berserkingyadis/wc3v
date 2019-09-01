const ScrubSpeeds = {
  '1/4x': 0.25,
  '1/2x': 0.5,
  '1x': 1,
  '2x': 2,
  '3x': 3,
  '4x': 4,
  '5x': 10,
  get: (speed) => {
    return ScrubSpeeds[speed];
  }
};

const TimeScrubber = class {
  constructor (wrapperId, canvasId) {
    this.wrapperId = wrapperId;
    this.canvasId = canvasId;
    this.svgCache = {};

    this.speedKey = '5x';
    this.speed = ScrubSpeeds.get(this.speedKey);
    this.timeStep = this.getTimeStep();

    this.wrapperEl = null;
    this.trackerEl = null;
    this.domEl = null;
    this.canvas = null;
    this.ctx = null;
  }

  init () {
    this.wrapperEl = document.getElementById(this.wrapperId);
    this.canvas = document.getElementById(this.canvasId);

    const existingDomEl = document.getElementById(`${this.wrapperId}-scrubber`);

    if (existingDomEl) {
      existingDomEl.remove();
    }

    this.domEl = document.createElement("div");
    this.domEl.setAttribute("id", `${this.wrapperId}-scrubber`);
    this.domEl.className = "time-scrubber";

    this.domEl.innerHTML = `
    <div id="${this.wrapperId}-play" class="time-scrubber-control play-button"></div>
    <div id="${this.wrapperId}-speed" class="time-scrubber-control speed-button">${this.speedKey}</div>
    <div class="time-scrubber-track">
      <div id="${this.wrapperId}-tracker" class="time-scrubber-tracker"></div>
    </div>`;

    this.wrapperEl.append(this.domEl);
    this.trackerEl = document.getElementById(`${this.wrapperId}-tracker`);

    this.loadSvg(`#${this.wrapperId}-play`, 'play-icon');
    this.loadSvg(`#${this.wrapperId}-play`, 'pause-icon', false);
    this.loadSvg(`#${this.wrapperId}-play`, 'stop-icon', false);
  }

  getTimeStep () {
    return (1000 / 60);
  }

  setupControls (domMap) {
    Object.keys(domMap).forEach(ctrlName => {
      const el = document.getElementById(`${this.wrapperId}-${ctrlName}`);
      el.addEventListener("click", domMap[ctrlName]);
    });
  }

  loadSvg(selector, svgFile, updateDom = true) {
    let target = document.querySelector(selector);
    if (this.svgCache[svgFile] && updateDom) {
      target.innerHTML = this.svgCache[svgFile].responseText;

      return;
    }

    // Request the SVG file
    const ajax = new XMLHttpRequest();
    ajax.open("GET", `/assets/${svgFile}.svg`, true);
    ajax.send();

    // Append the SVG to the target
    ajax.onload = (e) => {
      this.svgCache[svgFile] = {
        responseText: ajax.responseText
      };

      if (updateDom) {
        target = document.querySelector(selector);
        target.innerHTML = ajax.responseText;
      }
    }
  }

  renderScrubber () {
    
  }

  render (gameTime, matchEndTime) {
    const scrubberBox = this.wrapperEl.getBoundingClientRect();
    const { width } = scrubberBox;
    const matchPercentDone = (gameTime / matchEndTime) * 100;

    this.trackerEl.style.left = `${matchPercentDone}%`;
  }
};

window.TimeScrubber = TimeScrubber;
