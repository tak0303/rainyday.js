/**
 * Defines a new instance of the rainyday.js.
 * @param element DOM id of the image element used as background image
 * @param opacity opacity attribute value of the glass canvas (default: 1)
 * @param blur blur radius (default: 10)
 * @param fps desired fps for animation
 * @param speed desired speed for rain drops
 */

function RainyDay(options) {
	this.img = document.getElementById(options.element);
	this.img.style.visibility = 'hidden';
	this.opacity = options.opacity || 1;
	this.blurRadius = options.blur || 10;
	this.w = this.img.clientWidth;
	this.h = this.img.clientHeight;
	//Create a canvas element for drops
	this.canvas = this.prepareCanvas(this.img, options.autoHide);
	// draw and blur the background image
	this.prepareBackground(this.w, this.h);

	// create the glass canvas
	this.prepareGlass();

	this.drops = [];
	this.animateDrops();

	// assume default reflection mechanism
	this.reflection = this.REFLECTION_MINIATURE;

	// assume default trail mechanism
	this.trail = this.TRAIL_DROPS;

	// assume default gravity
	this.gravity = this.GRAVITY_NON_LINEAR;

	// drop size threshold for the gravity algorhitm
	this.VARIABLE_GRAVITY_THRESHOLD = 3;

	// gravity angle
	this.VARIABLE_GRAVITY_ANGLE = Math.PI / 2;

	// angle variance
	this.VARIABLE_GRAVITY_ANGLE_VARIANCE = 0;

	// frames per second animation speed
	this.VARIABLE_FPS = options.fps;

	// context fill style when no REFLECTION_NONE is used
	this.VARIABLE_FILL_STYLE = '#8ED6FF';

	// collisions enabled by default
	this.VARIABLE_COLLISIONS = true;

	this.REFLECTION_SCALEDOWN_FACTOR = 5;
	this.REFLECTION_DROP_MAPPING_WIDTH = 200;
	this.REFLECTION_DROP_MAPPING_HEIGHT = 200;

	// assume default collision algorhitm
	this.collision = this.COLLISION_SIMPLE;
}

/**
 * Create the main canvas over a given element
 * @param element to place the canvas on top of
 * @param autoHide determined whether to hide the canvas on mouse over
 * @returns the canvas
 */
RainyDay.prototype.prepareCanvas = function(element, autoHide) {
	var canvas = document.createElement('canvas');
	canvas.style.position = 'absolute';
	canvas.width = element.clientWidth;
	canvas.height = element.clientHeight;
	canvas.style.left = element.offsetLeft;
	canvas.style.top = element.offsetTop;
	document.getElementsByTagName('body')[0].appendChild(canvas);

	setInterval(function() {
		checkSize(canvas, element);
	}, 500);

	if (autoHide === true) {
		canvas.onmouseover = function() {
			canvas.style.display = 'none';
		};
		element.onmouseleave = function() {
			canvas.style.display = 'block';
		};
	}
	return canvas;
};

/**
 * Periodically check the size of the underlying element
 * @param canvas the canvas
 * @param element the element below
 */

function checkSize(canvas, element) {
	if (canvas.style.width !== element.clientWidth) {
		canvas.style.width = element.clientWidth;
	}
	if (canvas.style.height !== element.clientHeight) {
		canvas.style.height = element.clientHeight;
	}
	if (canvas.style.left !== element.offsetLeft) {
		canvas.style.left = element.offsetLeft;
	}
	if (canvas.style.top !== element.offsetTop) {
		canvas.style.top = element.offsetTop;
	}
}

RainyDay.prototype.animateDrops = function() {
	var raf = window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame;
	if (!raf) {
		raf = function(callback) {
			window.setTimeout(callback, 1000 / this.VARIABLE_FPS);
		};
	}
	if (this.addDropCallback) {
		this.addDropCallback();
	}
	// |this.drops| array may be changed as we iterate over drops
	var dropsClone = this.drops.slice();
	var newDrops = [];
	for (var i = 0; i < dropsClone.length; ++i) {
		if (dropsClone[i].animate()) {
			newDrops.push(dropsClone[i]);
		}
	}
	this.drops = newDrops;
	raf(this.animateDrops.bind(this));
};

/**
 * Create the helper canvas for rendering raindrop reflections.
 */
RainyDay.prototype.prepareReflections = function() {
	// new canvas
	this.reflected = document.createElement('canvas');
	this.reflected.width = this.canvas.width / this.REFLECTION_SCALEDOWN_FACTOR;
	this.reflected.height = this.canvas.height / this.REFLECTION_SCALEDOWN_FACTOR;

	var ctx = this.reflected.getContext('2d');

	ctx.drawImage(this.img, 0, 0, this.reflected.width, this.reflected.height);
};

/**
 * Create the glass canvas and position it directly over the main one.
 */
RainyDay.prototype.prepareGlass = function() {
	this.glass = document.createElement('canvas');
	this.glass.width = this.canvas.width;
	this.glass.height = this.canvas.height;
	this.context = this.glass.getContext('2d');
};

/**
 * Creates a new preset object with given attributes.
 * @param min minimum size of a drop
 * @param base base value for randomizing drop size
 * @param quan probability of selecting this preset (must be between 0 and 1)
 * @returns present object with given attributes
 */
RainyDay.prototype.preset = function(min, base, quan) {
	return {
		'min': min,
		'base': base,
		'quan': quan
	};
};

/**
 * Main function for starting rain rendering.
 * @param presets list of presets to be applied
 * @param speed speed of the animation (if not provided or 0 static image will be generated)
 */
RainyDay.prototype.rain = function(presets, speed) {
	// prepare canvas for drop reflections
	if (this.reflection !== this.REFLECTION_NONE) {
		this.prepareReflections();
	}

	if (speed > 0) {
		// animation
		this.presets = presets;

		this.PRIVATE_GRAVITY_FORCE_FACTOR_Y = (this.VARIABLE_FPS * 0.001) / 25;
		this.PRIVATE_GRAVITY_FORCE_FACTOR_X = ((Math.PI / 2) - this.VARIABLE_GRAVITY_ANGLE) * (this.VARIABLE_FPS * 0.001) / 50;

		// prepare gravity matrix
		if (this.VARIABLE_COLLISIONS) {

			// calculate max radius of a drop to establish gravity matrix resolution
			var maxDropRadius = 0;
			for (var i = 0; i < presets.length; i++) {
				if (presets[i].base + presets[i].min > maxDropRadius) {
					maxDropRadius = Math.floor(presets[i].base + presets[i].min);
				}
			}

			if (maxDropRadius > 0) {
				// initialize the gravity matrix
				var mwi = Math.ceil(this.w / maxDropRadius);
				var mhi = Math.ceil(this.h / maxDropRadius);
				this.matrix = new CollisionMatrix(mwi, mhi, maxDropRadius);
			} else {
				this.VARIABLE_COLLISIONS = false;
			}
		}
		var lastExecutionTime = 0;
		this.addDropCallback = function() {
			var timestamp = new Date().getTime();
			if (timestamp - lastExecutionTime < speed) {
				return;
			}
			lastExecutionTime = timestamp;
			var context = this.canvas.getContext('2d');
			context.clearRect(0, 0, this.canvas.width, this.canvas.height);
			var random = Math.random();
			// select matching preset
			var preset;
			for (var i = 0; i < presets.length; i++) {
				if (random < presets[i].quan) {
					preset = presets[i];
					break;
				}
			}
			if (preset) {
				this.putDrop(new Drop(this, Math.random() * this.w, Math.random() * this.h, preset.min, preset.base));
			}
			context.save();
			context.globalAlpha = this.opacity;
			context.drawImage(this.glass, 0, 0, this.canvas.width, this.canvas.height);
			context.restore();
		}.bind(this);

	} else {
		// static picture
		for (var i = 0; i < presets.length; i++) {
			var preset = presets[i];
			for (var c = 0; c < preset.quan; ++c) {
				this.putDrop(new Drop(this, Math.random() * this.w, Math.random() * this.h, preset.min, preset.base));
			}
		}
	}
};

/**
 * Adds a new raindrop to the animation.
 * @param drop drop object to be added to the animation
 */
RainyDay.prototype.putDrop = function(drop) {
	drop.draw();
	if (this.gravity && drop.r > this.VARIABLE_GRAVITY_THRESHOLD) {
		if (this.VARIABLE_COLLISIONS) {
			// put on the gravity matrix
			this.matrix.update(drop);
		}
		this.drops.push(drop);
	}
};

RainyDay.prototype.clearDrop = function(drop, force) {
	var result = drop.clear(force);
	if (result) {
		var index = this.drops.indexOf(drop);
		if (index >= 0) {
			this.drops.splice(index, 1);
		}
	}
	return result;
};

/**
 * Defines a new raindrop object.
 * @param rainyday reference to the parent object
 * @param centerX x position of the center of this drop
 * @param centerY y position of the center of this drop
 * @param min minimum size of a drop
 * @param base base value for randomizing drop size
 */

function Drop(rainyday, centerX, centerY, min, base) {
	this.x = Math.floor(centerX);
	this.y = Math.floor(centerY);
	this.r = (Math.random() * base) + min;
	this.rainyday = rainyday;
	this.context = rainyday.context;
	this.reflection = rainyday.reflected;
}

/**
 * Draws a raindrop on canvas at the current position.
 */
Drop.prototype.draw = function() {
	this.context.save();
	this.context.beginPath();

	var orgR = this.r;
	this.r = 0.95 * this.r;
	if (this.r < 3) {
		this.context.arc(this.x, this.y, this.r, 0, Math.PI * 2, true);
		this.context.closePath();
	} else if (this.colliding) {
		var collider = this.colliding;
		this.r = 1.001 * (this.r > collider.r ? this.r : collider.r);
		this.x += (collider.x - this.x);
		this.colliding = null;

		var randomizer = 1;
		var yr = 1 + 0.1 * this.yspeed;
		this.context.moveTo(this.x - this.r / yr, this.y);
		this.context.bezierCurveTo(this.x - this.r / randomizer, this.y - this.r * 2, this.x + this.r / randomizer, this.y - this.r * 2, this.x + this.r / yr, this.y);
		this.context.bezierCurveTo(this.x + this.r / randomizer, this.y + yr * this.r, this.x - this.r / randomizer, this.y + yr * this.r, this.x - this.r / yr, this.y);
	} else if (this.yspeed > 2) {
		var randomizer = 1;
		var yr = 1 + 0.1 * this.yspeed;
		this.context.moveTo(this.x - this.r / yr, this.y);
		this.context.bezierCurveTo(this.x - this.r / randomizer, this.y - this.r * 2, this.x + this.r / randomizer, this.y - this.r * 2, this.x + this.r / yr, this.y);
		this.context.bezierCurveTo(this.x + this.r / randomizer, this.y + yr * this.r, this.x - this.r / randomizer, this.y + yr * this.r, this.x - this.r / yr, this.y);
	} else {
		this.context.arc(this.x, this.y, this.r * 0.9, 0, Math.PI * 2, true);
		this.context.closePath();
	}

	this.context.clip();

	this.r = orgR;

	if (this.rainyday.reflection) {
		this.rainyday.reflection(this);
	}

	this.context.restore();
};

/**
 * Clears the raindrop region.
 * @param force force stop
 * @returns true if the animation is stopped
 */
Drop.prototype.clear = function(force) {
	this.context.clearRect(this.x - this.r - 1, this.y - this.r - 2, 2 * this.r + 2, 2 * this.r + 2);
	if (force) {
		// forced
		this.terminate = true;
		return true;
	}
	if (this.y - this.r > this.rainyday.h) {
		// over the bottom edge, stop the thread
		return true;
	}
	if ((this.x - this.r > this.rainyday.w) || (this.x + this.r < 0)) {
		// over the right or left edge, stop the thread
		return true;
	}
	return false;
};

/**
 * Moves the raindrop to a new position according to the gravity.
 */
Drop.prototype.animate = function() {
	if (this.terminate) {
		return false;
	}
	var stopped = this.rainyday.gravity(this);
	if (!stopped && this.rainyday.trail) {
		this.rainyday.trail(this);
	}
	if (this.rainyday.VARIABLE_COLLISIONS) {
		var collisions = this.rainyday.matrix.update(this, stopped);
		if (collisions) {
			this.rainyday.collision(this, collisions);
		}
	}
	return !stopped || this.terminate;
};

/**
 * TRAIL function: no trail at all
 * @param drop raindrop object
 */
RainyDay.prototype.TRAIL_NONE = function() {
	// nothing going on here
};

/**
 * TRAIL function: trail of small drops (default)
 * @param drop raindrop object
 */
RainyDay.prototype.TRAIL_DROPS = function(drop) {
	if (!drop.trail_y || drop.y - drop.trail_y >= Math.random() * 100 * drop.r) {
		drop.trail_y = drop.y;
		this.putDrop(new Drop(this, drop.x + (Math.random() * 2 - 1) * Math.random(), drop.y - drop.r - 5, Math.ceil(drop.r / 5), 0));
	}
};

/**
 * TRAIL function: trail of unblurred image
 * @param drop raindrop object
 */
RainyDay.prototype.TRAIL_SMUDGE = function(drop) {
	var y = drop.y - drop.r - 3;
	var x = drop.x - drop.r / 2 + (Math.random() * 2);
	if (y < 0 || x < 0) {
		return;
	}
	this.context.drawImage(this.clearbackground, x, y, drop.r, 2, x, y, drop.r, 2);
};

/**
 * GRAVITY function: no gravity at all
 * @param drop raindrop object
 * @returns true if the animation is stopped
 */
RainyDay.prototype.GRAVITY_NONE = function() {
	return true;
};

/**
 * GRAVITY function: linear gravity
 * @param drop raindrop object
 * @returns true if the animation is stopped
 */
RainyDay.prototype.GRAVITY_LINEAR = function(drop) {
	if (this.clearDrop(drop)) {
		return true;
	}

	if (drop.yspeed) {
		drop.yspeed += this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * Math.floor(drop.r);
		drop.xspeed += this.PRIVATE_GRAVITY_FORCE_FACTOR_X * Math.floor(drop.r);
	} else {
		drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
		drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
	}

	drop.y += drop.yspeed;
	drop.draw();
	return false;
};

/**
 * GRAVITY function: non-linear gravity (default)
 * @param drop raindrop object
 * @returns true if the animation is stopped
 */
RainyDay.prototype.GRAVITY_NON_LINEAR = function(drop) {
	if (this.clearDrop(drop)) {
		return true;
	}

	if (drop.collided) {
		drop.collided = false;
		drop.seed = Math.floor(drop.r * Math.random() * this.VARIABLE_FPS);
		drop.skipping = false;
		drop.slowing = false;
	} else if (!drop.seed || drop.seed < 0) {
		drop.seed = Math.floor(drop.r * Math.random() * this.VARIABLE_FPS);
		drop.skipping = drop.skipping === false ? true : false;
		drop.slowing = true;
	}

	drop.seed--;

	if (drop.yspeed) {
		if (drop.slowing) {
			drop.yspeed /= 1.1;
			drop.xspeed /= 1.1;
			if (drop.yspeed < this.PRIVATE_GRAVITY_FORCE_FACTOR_Y) {
				drop.slowing = false;
			}

		} else if (drop.skipping) {
			drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
			drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
		} else {
			drop.yspeed += 1 * this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * Math.floor(drop.r);
			drop.xspeed += 1 * this.PRIVATE_GRAVITY_FORCE_FACTOR_X * Math.floor(drop.r);
		}
	} else {
		drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
		drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
	}

	if (this.VARIABLE_GRAVITY_ANGLE_VARIANCE !== 0) {
		drop.xspeed += ((Math.random() * 2 - 1) * drop.yspeed * this.VARIABLE_GRAVITY_ANGLE_VARIANCE);
	}

	drop.y += drop.yspeed;
	drop.x += drop.xspeed;

	drop.draw();
	return false;
};

/**
 * REFLECTION function: no reflection at all
 * @param drop raindrop object
 */
RainyDay.prototype.REFLECTION_NONE = function() {
	this.context.fillStyle = this.VARIABLE_FILL_STYLE;
	this.context.fill();
};

/**
 * REFLECTION function: miniature reflection (default)
 * @param drop raindrop object
 */
RainyDay.prototype.REFLECTION_MINIATURE = function(drop) {
	// this maps the area of size (REFLECTION_DROP_MAPPING_WIDTH * 2, REFLECTION_DROP_MAPPING_HEIGHT * 2)
	// around point (drop.x, drop.y) into the drop area
	var sx = Math.max((drop.x - this.REFLECTION_DROP_MAPPING_WIDTH) / this.REFLECTION_SCALEDOWN_FACTOR, 0);
	var sy = Math.max((drop.y - this.REFLECTION_DROP_MAPPING_HEIGHT) / this.REFLECTION_SCALEDOWN_FACTOR, 0);
	var sw = Math.min(this.REFLECTION_DROP_MAPPING_WIDTH * 2 / this.REFLECTION_SCALEDOWN_FACTOR, this.reflected.width - sx);
	var sh = Math.min(this.REFLECTION_DROP_MAPPING_HEIGHT * 2 / this.REFLECTION_SCALEDOWN_FACTOR, this.reflected.height - sy);
	this.context.drawImage(this.reflected,
		// coordinates of source image
		sx, sy, sw, sh,
		// destination
		drop.x - 1.1 * drop.r,
		drop.y - 1.1 * drop.r,
		drop.r * 2,
		drop.r * 2);
};

/**
 * COLLISION function: default collision implementation
 * @param drop one of the drops colliding
 * @param colllisions list of potential collisions
 */
RainyDay.prototype.COLLISION_SIMPLE = function(drop, collisions) {
	var item = collisions;
	var drop2;
	while (item != null) {
		var p = item.drop;
		if (Math.sqrt(Math.pow(drop.x - p.x, 2) + Math.pow(drop.y - p.y, 2)) < (drop.r + p.r)) {
			drop2 = p;
			break;
		}
		item = item.next;
	}

	if (!drop2) {
		return;
	}

	// rename so that we're dealing with low/high drops
	var higher, lower;
	if (drop.y > drop2.y) {
		higher = drop;
		lower = drop2;
	} else {
		higher = drop2;
		lower = drop;
	}

	this.clearDrop(lower);
	// force stopping the second drop
	this.clearDrop(higher, true);
	this.matrix.remove(higher);
	lower.draw();

	lower.colliding = higher;
	lower.collided = true;
};

/**
 * Resizes canvas, draws original image and applies bluring algorithm.
 * @param width width of the canvas
 * @param height height of the canvas
 */
RainyDay.prototype.prepareBackground = function(width, height) {
	if (width && height) {
		this.canvas.style.width = width + 'px';
		this.canvas.style.height = height + 'px';
		this.canvas.width = width;
		this.canvas.height = height;
	} else {
		width = this.canvas.width;
		height = this.canvas.height;
	}

	this.background = document.createElement('canvas');
	if (!isNaN(this.blurRadius) && this.blurRadius >= 1) {
		this.background.setAttribute('style', '-webkit-filter: blur(' + this.blurRadius + 'px); -webkit-transform: translatez(0);');
	}
	this.background.style.position = 'absolute';
	this.background.width = this.canvas.width;
	this.background.height = this.canvas.height;
	this.background.style.left = this.canvas.offsetLeft;
	this.background.style.top = this.canvas.offsetTop;
	this.background.style.zIndex = this.canvas.style.zIndex - 100;
	document.getElementsByTagName('body')[0].appendChild(this.background);

	this.clearbackground = document.createElement('canvas');
	this.clearbackground.width = this.canvas.width;
	this.clearbackground.height = this.canvas.height;

	var context = this.background.getContext('2d');
	context.clearRect(0, 0, width, height);
	context.drawImage(this.img, 0, 0, width, height);

	context = this.clearbackground.getContext('2d');
	context.clearRect(0, 0, width, height);
	context.drawImage(this.img, 0, 0, width, height);
};

/**
 * Defines a gravity matrix object which handles collision detection.
 * @param x number of columns in the matrix
 * @param y number of rows in the matrix
 * @param r grid size
 */

function CollisionMatrix(x, y, r) {
	this.resolution = r;
	this.xc = x;
	this.yc = y;
	this.matrix = new Array(x);
	for (var i = 0; i <= (x + 5); i++) {
		this.matrix[i] = new Array(y);
		for (var j = 0; j <= (y + 5); ++j) {
			this.matrix[i][j] = new DropItem(null);
		}
	}
}

/**
 * Updates position of the given drop on the collision matrix.
 * @param drop raindrop to be positioned/repositioned
 * @forceDelete if true the raindrop will be removed from the matrix
 * @returns collisions if any
 */
CollisionMatrix.prototype.update = function(drop, forceDelete) {
	if (drop.gid) {
		this.matrix[drop.gmx][drop.gmy].remove(drop);
		if (forceDelete) {
			return null;
		}

		drop.gmx = Math.floor(drop.x / this.resolution);
		drop.gmy = Math.floor(drop.y / this.resolution);
		if (!this.matrix[drop.gmx] || !this.matrix[drop.gmx][drop.gmy]) {
			return null;
		}
		this.matrix[drop.gmx][drop.gmy].add(drop);

		var collisions = this.collisions(drop);
		if (collisions && collisions.next != null) {
			return collisions.next;
		}
	} else {
		drop.gid = Math.random().toString(36).substr(2, 9);
		drop.gmx = Math.floor(drop.x / this.resolution);
		drop.gmy = Math.floor(drop.y / this.resolution);
		if (!this.matrix[drop.gmx] || !this.matrix[drop.gmx][drop.gmy]) {
			return null;
		}

		this.matrix[drop.gmx][drop.gmy].add(drop);
	}
	return null;
};

/**
 * Looks for collisions with the given raindrop.
 * @param drop raindrop to be checked
 * @returns list of drops that collide with it
 */
CollisionMatrix.prototype.collisions = function(drop) {
	var item = new DropItem(null);
	var first = item;

	item = this.addAll(item, drop.gmx - 1, drop.gmy + 1);
	item = this.addAll(item, drop.gmx, drop.gmy + 1);
	item = this.addAll(item, drop.gmx + 1, drop.gmy + 1);

	return first;
};

/**
 * Appends all found drop at a given location to the given item.
 * @param to item to which the results will be appended to
 * @param x x position in the matrix
 * @param y y position in the matrix
 * @returns last discovered item on the list
 */
CollisionMatrix.prototype.addAll = function(to, x, y) {
	if (x > 0 && y > 0 && x < this.xc && y < this.yc) {
		var items = this.matrix[x][y];
		while (items.next != null) {
			items = items.next;
			to.next = new DropItem(items.drop);
			to = to.next;
		}
	}
	return to;
};

/**
 * Removed the drop from its current position
 * @param drop to be removed
 */
CollisionMatrix.prototype.remove = function(drop) {
	this.matrix[drop.gmx][drop.gmy].remove(drop);
};

/**
 * Defines a linked list item.
 */

function DropItem(drop) {
	this.drop = drop;
	this.next = null;
}

/**
 * Adds the raindrop to the end of the list.
 * @param drop raindrop to be added
 */
DropItem.prototype.add = function(drop) {
	var item = this;
	while (item.next != null) {
		item = item.next;
	}
	item.next = new DropItem(drop);
};

/**
 * Removes the raindrop from the list.
 * @param drop raindrop to be removed
 */
DropItem.prototype.remove = function(drop) {
	var item = this;
	var prevItem = null;
	while (item.next != null) {
		prevItem = item;
		item = item.next;
		if (item.drop.gid === drop.gid) {
			prevItem.next = item.next;
		}
	}
};