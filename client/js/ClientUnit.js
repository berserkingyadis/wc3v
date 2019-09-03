const _iconCache = {};

const IconSizes = {
  'hero': 30,
  'unit': 20,
  'worker': 10,
  'building': 20
};

const ClientUnit = class {
  constructor (unitData, playerColor) {
    const dataFields = [ 
      "displayName", "itemId", "itemId1", "itemId2",
      "objectId1", "objectId2", "isRegistered", "isUnit",
      "isBuilding", "isIllusion", "level", "lastPosition",
      "path", "moveHistory", "meta", "items", "spawnTime",
      "spawnPosition"
    ];

    dataFields.forEach(field => {
      this[field] = unitData[field] || null;
    });

    this.playerColor = playerColor;
    this.setup();

    this.loadIcon();
  }

  loadIcon () {
    const img = new Image();
    const imgSrc = `/assets/wc3icons/${this.itemId}.jpg`;
    
    this.icon = null;

    if (_iconCache[imgSrc]) {
      this.icon = _iconCache[imgSrc];
      return;
    }

    img.src = imgSrc;
    img.onload = () => {
      if (!_iconCache[imgSrc]) {
        _iconCache[imgSrc] = img;
      }

      this.icon = img;
    };
  }

  setup () {
    // figure out initial position

    if (this.spawnPosition) {
      const { x, y } = this.spawnPosition;

      this.currentX = x;
      this.currentY = y;
    } else {
      const { x, y } = this.lastPosition;

      this.currentX = x;
      this.currentY = y;
    }

    this.currentMoveRecordIndex = -1;
    this.decayLevel = 1;

    if (this.meta.hero) {
      this.iconSize = IconSizes.hero;
    } else if (this.isBuilding) {
      this.iconSize = IconSizes.building;
    } else if (this.meta.worker) {
      this.iconSize = IconSizes.worker;
    } else {
      this.iconSize = IconSizes.unit;
    }
  }

  getCurrentMoveRecord (gameTime) {
    const index = this.moveHistory.findIndex(record => {
      const { startTime, endTime } = record.timerData;

      if (gameTime >= startTime && gameTime <= endTime) {
        return record;
      }
    });

    if (index === -1) {
      return false;
    }

    if (this.currentMoveRecordIndex !== index) {
      this.initMove(index);
    }

    this.currentMoveRecordIndex = index;
    return true;
  }

  initMove (index) {
    const { targetX, targetY } = this.moveHistory[index];

    const pathDistance = Helpers.distance(
      this.currentX, this.currentY,
      targetX, targetY
    );

    const ms = (this.meta.movespeed || 250);
    const pathTime = (pathDistance / ms);

    this.decayLevel = 1;
    this.moveInfo = {
      startX: this.currentX,
      startY: this.currentY,
      targetX: targetX,
      targetY: targetY,
      xDirection: (targetX > this.currentX) ? 1 : -1,
      yDirection: (targetY > this.currentY) ? 1 : -1,
      pathDistance: pathDistance,
      pathTime: pathTime,
      xVelocity: (Math.abs(targetX - this.currentX) / pathTime),
      yVelocity: (Math.abs(targetY - this.currentY) / pathTime)
    };
  }

  decay (dt) {
    this.decayLevel -= this.meta.hero ? 0.0005 : 0.0025;

    if (this.meta.worker) {
      this.decayLevel = Math.max(0.2, this.decayLevel);
    } else {
      this.decayLevel = Math.max(0.0, this.decayLevel);
    }
  }

  update (gameTime, dt) {
    if (gameTime < this.spawnTime) {
      return;
    }

    const hasRecord = this.getCurrentMoveRecord(gameTime);
    if (!hasRecord) {
      this.decay();

      return;
    }

    const secondsPassed = (dt * Helpers.MS_TO_SECONDS);
    const {
      xDirection,
      yDirection,
      xVelocity,
      yVelocity
    } = this.moveInfo;

    // direction vector * velocity * time delta

    const xDelta = (xDirection * xVelocity * secondsPassed);
    const yDelta = (yDirection * yVelocity * secondsPassed);

    // update the postion
    this.currentX += xDelta;
    this.currentY += yDelta;
  }

  renderBuilding (ctx, xScale, yScale, middleX, middleY) {
    const { x, y } = this.lastPosition;
    const drawX = xScale(x) + middleX;
    const drawY = yScale(y) + middleY;
    const iconSize = this.iconSize;

    ctx.drawImage(this.icon, drawX, drawY, iconSize, iconSize);

    ctx.strokeStyle = "#FFFC01";
    ctx.strokeRect(drawX, drawY, iconSize, iconSize);
    ctx.strokeStyle = "#000000";
  }

  renderUnit (ctx, gameTime, xScale, yScale, middleX, middleY) {
    if (!this.currentX || !this.currentY) {
      return;
    }

    const { currentX, currentY } = this;
    const drawX = xScale(currentX) + middleX;
    const drawY = yScale(currentY) + middleY;

    const iconSize = this.iconSize;
    const halfIconSize = iconSize / 2;
    // draw code

    ctx.strokeStyle = "#FFFC01";
    ctx.globalAlpha = this.decayLevel;

    // clip our initial circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(drawX, drawY, halfIconSize, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    // draw the icons
    ctx.drawImage(
      this.icon, 
      (drawX - halfIconSize), 
      (drawY - halfIconSize), 
      iconSize, 
      iconSize
    );

    // draw the icon ring
    ctx.beginPath();
    ctx.arc(drawX, drawY, halfIconSize, 0, Math.PI * 2, true);
    ctx.stroke();
    ctx.closePath();

    ctx.restore();

    const drawTextX = drawX - (this.displayName.length * 2);
    const drawTextY = drawY + halfIconSize;

    ctx.fillStyle = "#FFF";
    ctx.fillText(this.displayName, drawTextX, drawTextY );
    ctx.fillStyle = "#000";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colorMap.black;
  }

  render (ctx, gameTime, xScale, yScale, middleX, middleY) {
    if (gameTime < this.spawnTime) {
      return;
    }

    if (this.isBuilding) {
      this.renderBuilding(ctx, xScale, yScale, middleX, middleY);
    } else {
      this.renderUnit(ctx, gameTime, xScale, yScale, middleX, middleY);
    }
  }
}

window.ClientUnit = ClientUnit;
