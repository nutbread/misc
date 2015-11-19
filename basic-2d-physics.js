// http://gamedev.stackexchange.com/questions/55873/hexagon-collision-detection-for-fast-moving-objects
(function () {
	"use strict";

	var IntersectionTester = function () {
		this.dx = 0;
		this.dy = 0;
		this.x1 = 0;
		this.y1 = 0;
		this.x2 = 0;
		this.y2 = 0;
		this.length_sq = 0;
		this.det = 0;

		this.r_x = 0;
		this.r_y = 0;
		this.r_normal = null;
		this.invalid = 0;
		this.r_dist_sq = 0;
	};
	IntersectionTester.prototype = {
		constructor: IntersectionTester,
		init: function (x1, y1, dx, dy, length_sq) {
			this.dx = dx;
			this.dy = dy;
			this.x1 = x1;
			this.y1 = y1;
			this.x2 = x1 + dx;
			this.y2 = y1 + dy;
			this.length_sq = length_sq;
			this.det = x1 * this.y2 - y1 * this.x2;

			this.r_normal = null;
			this.r_dist_sq = this.length_sq * 2;
		},
		test: function (other, normal_index) {
			var divisor = this.dx * other.dy - this.dy * other.dx,
				dx, dy, x, y, dot;

			// Parallel
			if (divisor === 0) return;

			// Find the intersection
			x = (other.det * this.dx - this.det * other.dx) / divisor;
			y = (other.det * this.dy - this.det * other.dy) / divisor;

			// Test if the intersection is on the segments
			if (
				(dot = (x - other.x1) * other.dx + (y - other.y1) * other.dy) < 0 ||
				dot > other.length_sq ||
				(dot = (dx = (x - this.x1)) * this.dx + (dy = (y - this.y1)) * this.dy) < 0 ||
				dot > this.length_sq
			) {
				return;
			}

			// Assign the point, distance squared from (x1,y1), and normal to the results
			dx *= dx;
			dx += dy * dy;
			if (dx <= this.r_dist_sq) {
				this.r_x = x;
				this.r_y = y;
				this.r_normal = IntersectionTester.normals[normal_index];
				this.r_dist_sq = dx;
			}
		},
		test_end: function (other, x_offset, y_offset) {
			var divisor = this.dx * other.dy - this.dy * other.dx,
				dx, dy, x, y;

			// Parallel
			if (divisor === 0) return 1;

			// Find the intersection
			x = (other.det * this.dx - this.det * other.dx) / divisor;
			y = (other.det * this.dy - this.det * other.dy) / divisor;

			// Test if the intersection is in the right direction
			if (((x - other.x1) * other.dx + (y - other.y1) * other.dy) < 0) {
				other.x1 += x_offset;
				other.y1 += y_offset;
				other.x2 = other.x1 + other.dx;
				other.y2 = other.y1 + other.dy;
				other.det = other.x1 * other.y2 - other.y1 * other.x2;

				x = (other.det * this.dx - this.det * other.dx) / divisor;
				y = (other.det * this.dy - this.det * other.dy) / divisor;

				//console.log("Side 2");
				if (((x - other.x1) * other.dx + (y - other.y1) * other.dy) < 0) {
					// Should rarely happen
					return 1;
				}
			}

			// This distance doesn't need to be validated
			dx = x - this.x1;
			dy = y - this.y1;

			// Assign the point, distance squared from (x1,y1), and normal to the results
			dx *= dx;
			dx += dy * dy;
			//console.log("OK!",this.length_sq,dx);
			return Math.min(1, dx / this.length_sq);
		},
		to_right: function (right) {
			this.x1 = right;
			this.x2 = right;
			this.det = this.dy * right;
		},
		to_y: function (left, top, width) {
			this.x1 = left;
			this.y2 = top;
			this.length_sq = width * width;
			this.det = -top * width;
			this.dx = width;
			this.dy = 0;
		},
		to_bottom: function (bottom) {
			this.y1 = bottom;
			this.y2 = bottom;
			this.det = -bottom * this.dx;
		},
		valid: function () {
			return (this.r_normal !== null);
		}
	};
	IntersectionTester.normals = [
		[ -1, 0, -0.5, -0.5, 0, 1 ], // tangent_x, tangent_y, offset_x1, offset_y1, offset_dx, offset_dy
		[ 1, 0, 0.5, -0.5, 0, 1 ],
		[ 0, -1, -0.5, -0.5, 1, 0 ],
		[ 0, 1, -0.5, 0.5, 1, 0 ]
	];

	var Collision = function () {
		this.int1 = new IntersectionTester();
		this.int2 = new IntersectionTester();
		this.dx = 0;
		this.dy = 0;
	};
	Collision.prototype = {
		constructor: Collision,
		test: function (object1, object2, callback) {
			var o1_width_half = object1.width / 2,
				o1_height_half = object1.height / 2,
				ww = object1.width + object2.width,
				hh = object1.height + object2.height,
				o2_left = object2.x - o1_width_half,
				o2_top = object2.y - o1_height_half,
				int1 = this.int1,
				int2 = this.int2;

			this.dx = object1.speed.x - object2.speed.x;
			this.dy = object1.speed.y - object2.speed.y;

			// Find intersection with minimum distance
			int1.init(object1.x + o1_width_half, object1.y + o1_height_half, this.dx, this.dy, this.dx * this.dx + this.dy * this.dy);
			int2.init(o2_left, o2_top, 0, hh, hh * hh);
			int1.test(int2, 0);
			int2.to_right(o2_left + ww);
			int1.test(int2, 1);
			int2.to_y(o2_left, o2_top, ww);
			int1.test(int2, 2);
			int2.to_bottom(o2_top + hh);
			int1.test(int2, 3);

			// Initial position
			if (callback) callback(Collision.INITIAL, object1.x, object1.y, object2.x, object2.y, null);

			// Intersection occured
			var mode = Collision.FINAL,
				result = null;

			if (int1.valid()) {
				// Resolve
				this.resolve(object1, object2, callback);

				// Targeted location
				mode = Collision.TARGET;
			}
			else {
				// Final location
				result = [];
			}

			// Targeted location
			if (callback) callback(mode, object1.x + object1.speed.x, object1.y + object1.speed.y, object2.x + object2.speed.x, object2.y + object2.speed.y, result);
		},
		resolve: function (object1, object2, callback) {
			var t = Math.sqrt(this.int1.r_dist_sq / this.int1.length_sq),
				t_inv = 1 - t,
				ww = object1.width + object2.width,
				hh = object1.height + object2.height,
				o1_x = object1.x + object1.speed.x * t,
				o1_y = object1.y + object1.speed.y * t,
				o2_x = object2.x + object2.speed.x * t,
				o2_y = object2.y + object2.speed.y * t,
				tx = this.int1.r_normal[1],
				ty = this.int1.r_normal[0],
				weight1 = object1.weight * object1.weight_transfer * object2.weight_accept,
				weight2 = object2.weight * object2.weight_transfer * object1.weight_accept,
				weight_total,
				o1_remaining_speed_x = object1.speed.x * t_inv,
				o1_remaining_speed_y = object1.speed.y * t_inv,
				o2_remaining_speed_x = object2.speed.x * t_inv,
				o2_remaining_speed_y = object2.speed.y * t_inv,
				o1_new_speed_x, o1_new_speed_y,
				o2_new_speed_x, o2_new_speed_y,
				force_x, force_y, a1, a2, dx, dy, nr, s, m1, m2, m_inv;

			// Start of the collision
			if (callback) callback(Collision.START, o1_x, o1_y, o2_x, o2_y, null);

			// Weighting
			weight_total = weight1 + weight2;
			if (weight_total > 0) {
				weight1 /= weight_total;
				weight2 /= weight_total;
			}

			// Remining speed after collision
			a1 = (o1_remaining_speed_x * tx + o1_remaining_speed_y * ty);
			a2 = (o2_remaining_speed_x * tx + o2_remaining_speed_y * ty);

			o1_new_speed_x = a1 * tx;
			o1_new_speed_y = a1 * ty;

			o2_new_speed_x = a2 * tx;
			o2_new_speed_y = a2 * ty;

			force_x = (o1_remaining_speed_x - o1_new_speed_x) * weight1 + (o2_remaining_speed_x - o2_new_speed_x) * weight2;
			force_y = (o1_remaining_speed_y - o1_new_speed_y) * weight1 + (o2_remaining_speed_y - o2_new_speed_y) * weight2;

			o1_new_speed_x += force_x;
			o1_new_speed_y += force_y;
			o2_new_speed_x += force_x;
			o2_new_speed_y += force_y;

			// Only do this if momentum transfer != 1
			m1 = object1.motion_accept * object2.motion_transfer;
			m2 = object2.motion_accept * object1.motion_transfer;
			if (m1 !== 1 || m2 !== 1 || callback) {
				// Find distance until collision end
				nr = this.int1.r_normal;
				a1 = (tx * o2_new_speed_x + ty * o2_new_speed_y);
				dx = o1_new_speed_x - tx * a1;
				dy = o1_new_speed_y - ty * a1;
				s = ( // If the direction was flipped with respect to the collision normal, the comparison normals need to be flipped as well
					((this.dx * nr[0] + this.dy * nr[1]) >= 0) ===
					((dx * nr[0] + dy * nr[1]) >= 0)
				) ? -1 : 1;

				this.int1.init(o1_x + object1.width / 2, o1_y + object1.height / 2, dx, dy, dx * dx + dy * dy);
				this.int2.init(o2_x + object2.width / 2 + nr[2] * ww, o2_y + object2.height / 2 + nr[3] * hh, nr[0] * s, nr[1] * s, 1);
				t = Math.sqrt(this.int1.test_end(this.int2, nr[4] * ww, nr[5] * hh));
/*if(0){
	this.int2.init(o2_x + object2.width / 2 + nr[2] * ww, o2_y + object2.height / 2 + nr[3] * hh, nr[0]*100 * s, nr[1]*100 * s, 1);
	var n = document.createElementNS(svgns, "path");
	n.setAttribute("style", "stroke:cyan;stroke-width:4px;");
	n.setAttribute("d", [
		"M", this.int1.x1, this.int1.y1, "L", this.int1.x2, this.int1.y2,
		"M", this.int2.x1, this.int2.y1, "L", this.int2.x2, this.int2.y2,
		"M", this.int2.x1+nr[4] * ww, this.int2.y1+nr[5] * hh, "L", this.int2.x2+nr[4] * ww, this.int2.y2+nr[5] * hh,
	].join(" "));
	setTimeout(function(){document.querySelector("svg").appendChild(n);},1);
}
console.log("t=",t);
			a1 = (tx * o1_new_speed_x + ty * o1_new_speed_y);
			dx = o2_new_speed_x - tx * a1;
			dy = o2_new_speed_y - ty * a1;

			this.int1.init(o2_x + object2.width / 2, o2_y + object2.height / 2, dx, dy, dx * dx + dy * dy);
			this.int2.init(o1_x + object1.width / 2 - nr[2] * ww, o1_y + object1.height / 2 - nr[3] * hh, nr[0] * s, nr[1] * s, 1);
			t = Math.sqrt(this.int1.test_end(this.int2, -nr[4] * ww, -nr[5] * hh));
			console.log("t=",t);
*/
				// Continue movement until end of collision
				o1_x += o1_new_speed_x * t;
				o1_y += o1_new_speed_y * t;
				o2_x += o2_new_speed_x * t;
				o2_y += o2_new_speed_y * t;

				// Momentum transfer
				m_inv = 1 - m1;
				o1_new_speed_x = o1_remaining_speed_x * m_inv + o1_new_speed_x * m1;
				o1_new_speed_y = o1_remaining_speed_y * m_inv + o1_new_speed_y * m1;
				m_inv = 1 - m2;
				o2_new_speed_x = o2_remaining_speed_x * m_inv + o2_new_speed_x * m2;
				o2_new_speed_y = o2_remaining_speed_y * m_inv + o2_new_speed_y * m2;

				if (t < 1) {
					// End of collision
					callback(Collision.END, o1_x, o1_y, o2_x, o2_y, null);

					t_inv = 1 - t;
					o1_x += o1_new_speed_x * t_inv;
					o1_y += o1_new_speed_y * t_inv;
					o2_x += o2_new_speed_x * t_inv;
					o2_y += o2_new_speed_y * t_inv;
				}
			}
			else{
				o1_x += o1_new_speed_x;
				o1_y += o1_new_speed_y;
				o2_x += o2_new_speed_x;
				o2_y += o2_new_speed_y;
			}

			// Final location
			if (callback) callback(Collision.FINAL, o1_x, o1_y, o2_x, o2_y, []);
		},
	};
	Collision.INITIAL = 0;
	Collision.START = 1;
	Collision.END = 2;
	Collision.FINAL = 3;
	Collision.TARGET = 4;

	var on_ready = (function () {

		// Vars
		var callbacks = [],
			check_interval = null,
			check_interval_time = 250;

		// Check if ready and run callbacks
		var callback_check = function () {
			if (
				(document.readyState === "interactive" || document.readyState === "complete") &&
				callbacks !== null
			) {
				// Run callbacks
				var cbs = callbacks,
					cb_count = cbs.length,
					i;

				// Clear
				callbacks = null;

				for (i = 0; i < cb_count; ++i) {
					cbs[i].call(null);
				}

				// Clear events and checking interval
				window.removeEventListener("load", callback_check, false);
				window.removeEventListener("readystatechange", callback_check, false);

				if (check_interval !== null) {
					clearInterval(check_interval);
					check_interval = null;
				}

				// Okay
				return true;
			}

			// Not executed
			return false;
		};

		// Listen
		window.addEventListener("load", callback_check, false);
		window.addEventListener("readystatechange", callback_check, false);

		// Callback adding function
		return function (cb) {
			if (callbacks === null) {
				// Ready to execute
				cb.call(null);
			}
			else {
				// Delay
				callbacks.push(cb);

				// Set a check interval
				if (check_interval === null && callback_check() !== true) {
					check_interval = setInterval(callback_check, check_interval_time);
				}
			}
		};

	})();

	var bind = function (callback, self) {
		if (arguments.length > 2) {
			var slice = Array.prototype.slice,
				push = Array.prototype.push,
				args = slice.call(arguments, 2);

			return function () {
				var full_args = slice.call(args);
				push.apply(full_args, arguments);

				return callback.apply(self, full_args);
			};
		}
		else {
			return function () {
				return callback.apply(self, arguments);
			};
		}
	};

	var setup_input_change = function (node, object, keys, preprocessor) {
		var o = object,
			range = [ null, null ],
			v = node.getAttribute("data-range"),
			bounders = setup_input_change.bounders,
			updater = node.getAttribute("data-update"),
			pp = setup_input_change.preprocessors[(preprocessor === null) ? "standard" : preprocessor],
			i;

		var on_weight_change = function () {
			var v = parseFloat(this.value.trim()),
				o = object,
				r, i;

			if (!isNaN(v) && isFinite(v)) {
				if (
					(r = range[0]) !== null &&
					(typeof(r) !== "function" || (r = r(object)) !== null) &&
					v < r
				) {
					v = r;
				}
				if (
					(r = range[1]) !== null &&
					(typeof(r) !== "function" || (r = r(object)) !== null) &&
					v > r
				) {
					v = r;
				}

				for (i = 0; i < keys.length - 1; ++i) o = o[keys[i]];
				o[keys[i]] = pp.set(v, object);

				updater();
			}
			else {
				for (i = 0; i < keys.length - 1; ++i) o = o[keys[i]];
				v = pp.get(o[keys[i]], object);
			}

			this.value = "" + v;
		};

		if (v) {
			v = v.split(",");
			if (v[0]) {
				range[0] = (v[0] in bounders) ? bounders[v[0]] : parseFloat(v[0]);
			}
			if (v[1]) {
				range[1] = (v[1] in bounders) ? bounders[v[1]] : parseFloat(v[1]);
			}
		}

		updater = setup_input_change.update[(updater && updater in setup_input_change.update) ? updater : "full"];

		for (i = 0; i < keys.length - 1; ++i) o = o[keys[i]];
		node.value = pp.get(o[keys[i]], object);

		node.addEventListener("change", on_weight_change, false);
	};
	setup_input_change.bounders = {
		bound_width: function (object) {
			var n = document.querySelector(".preview.preview_main");
			return (n === null) ? null : (n.getBoundingClientRect().width - object.width);
		},
		bound_height: function (object) {
			var n = document.querySelector(".preview.preview_main");
			return (n === null) ? null : (n.getBoundingClientRect().height - object.height);
		},
	};
	setup_input_change.preprocessors = {
		standard: {
			get: function (value) {
				return value;
			},
			set: function (value) {
				return value;
			}
		},
		modify_speed_x: {
			get: function (value, object) {
				return value + object.x;
			},
			set: function (value, object) {
				return value - object.x;
			}
		},
		modify_speed_y: {
			get: function (value, object) {
				return value + object.y;
			},
			set: function (value, object) {
				return value - object.y;
			}
		}
	};
	setup_input_change.update = {
		collision: function () {
			update(objects, false);
		},
		full: function () {
			display.update_size(objects);
			update(objects, false);
		}
	};

	var load_from_url = function (o1, o2) {
		var h = window.location.hash.replace(/^#/, "").split(","),
			i;

		if (h.length >= 22) {
			for (i = 0; i < h.length; ++i) {
				h[i] = parseFloat(h[i]);
			}
			o1.x = h[0];
			o1.y = h[1];
			o1.speed.x = h[2];
			o1.speed.y = h[3];
			o1.width = h[4];
			o1.height = h[5];
			o1.weight = h[6];
			o1.weight_transfer = h[7];
			o1.weight_accept = h[8];
			o1.motion_transfer = h[9];
			o1.motion_accept = h[10];
			o2.x = h[11];
			o2.y = h[12];
			o2.speed.x = h[13];
			o2.speed.y = h[14];
			o2.width = h[15];
			o2.height = h[16];
			o2.weight = h[17];
			o2.weight_transfer = h[18];
			o2.weight_accept = h[19];
			o2.motion_transfer = h[20];
			o2.motion_accept = h[21];
		}
	};
	var update_url = function (o1, o2) {
		window.history.replaceState(null, "",
			"#" + o1.x + "," + o1.y + "," + o1.speed.x + "," + o1.speed.y + "," + o1.width + "," + o1.height + "," +
			o1.weight + "," + o1.weight_transfer + "," + o1.weight_accept + "," + o1.motion_transfer + "," + o1.motion_accept +
			"," + o2.x + "," + o2.y + "," + o2.speed.x + "," + o2.speed.y + "," + o2.width + "," + o2.height + "," +
			o2.weight + "," + o2.weight_transfer + "," + o2.weight_accept + "," + o2.motion_transfer + "," + o2.motion_accept
		);
	};

	var escape_regex = function (exp) {
		return exp.replace(/[\$\(\)\*\+\-\.\/\?\[\\\]\^\{\|\}]/g, "\\$&");
	};

	var add_class = function (node, cls) {
		if (node.classList) {
			node.classList.add(cls);
		}
		else {
			var cls_name = (node.getAttribute("class") || "").trim();
			if (cls_name.length === 0) {
				node.setAttribute("class", cls);
			}
			else if (!(new RegExp("\\b" + escape_regex(cls) + "\\b")).test(cls_name)) {
				node.setAttribute("class", cls_name + " " + cls);
			}
		}
	};
	var remove_class = function (node, cls) {
		if (node.classList) {
			node.classList.remove(cls);
		}
		else {
			node.setAttribute("class", (node.getAttribute("class") || "").replace(new RegExp("(?:^|\\s+)" + escape_regex(cls) + "(?:\\s+|$)", "g"), " ").trim());
		}
	};
	var has_class = function (node, cls) {
		if (node.classList) {
			return node.classList.contains(cls);
		}
		else {
			return (new RegExp("\\b" + escape_regex(cls) + "\\b")).test(node.getAttribute("class") || "");
		}
	};

	var get_object_rect = function (node) {
		var bounds = node.getBoundingClientRect(),
			doc_el = document.documentElement,
			left = (window.pageXOffset || doc_el.scrollLeft || 0) - (doc_el.clientLeft || 0),
			top = (window.pageYOffset || doc_el.scrollTop || 0)  - (doc_el.clientTop || 0);

		return {
			left: left + bounds.left,
			top: top + bounds.top,
			right: left + bounds.right,
			bottom: top + bounds.bottom,
			width: bounds.width,
			height: bounds.height,
		};
	};

	var find_svg_parent = function (node) {
		while (node.tagName.toLowerCase() !== "svg") {
			node = node.parentNode;
			if (node === null) return document;
		}
		return node;
	};

	var display = function (objects, datas) {
		var data_names = [ "initial", "collision_start", "collision_end", "final", "target" ],
			stroke_width_half = 0.5,
			nodes, data, i;

		// Show rectangles
		for (i = 0; i < datas.length; ++i) {
			data = datas[i];
			if (data === null) {
				display.foreach(document, ".preview>.fills>." + data_names[i] + ",.preview>.outlines>." + data_names[i], function () {
					add_class(this, "hidden");
				});
			}
			else {
				display.foreach(document, ".preview>.fills>." + data_names[i], function (index) {
					this.setAttribute("x", data[0 + index * 2]);
					this.setAttribute("y", data[1 + index * 2]);
					remove_class(this, "hidden");
				});
				display.foreach(document, ".preview>.outlines>." + data_names[i], function (index) {
					this.setAttribute("x", data[0 + index * 2] + stroke_width_half);
					this.setAttribute("y", data[1 + index * 2] + stroke_width_half);
					remove_class(this, "hidden");
				});
			}
		}

		// Show paths
		if (datas[1] === null) {
			display.foreach(document, ".preview>.trajectories>:not(.to_final)", function () {
				add_class(this, "hidden");
			});
			display.show_path("to_final", objects, datas[0], datas[3]);
		}
		else {
			display.show_path("to_collision_start", objects, datas[0], datas[1]);
			if (datas[2] !== null) {
				display.show_path("to_collision_end", objects, datas[1], datas[2]);
				display.show_path("to_final", objects, datas[2], datas[3]);
			}
			else {
				display.foreach(document, ".preview>.trajectories>.to_collision_end", function () {
					add_class(this, "hidden");
				});
				display.show_path("to_final", objects, datas[1], datas[3]);
			}
			display.show_path("to_target", objects, datas[1], datas[4], true);
		}
	};
	display.foreach = function (node, selector, callback) {
		var nodes = node.querySelectorAll(selector),
			i;
		for (i = 0; i < nodes.length; ++i) {
			callback.call(nodes[i], has_class(nodes[i], "object2") ? 1 : 0);
		}
	};
	display.show_path = function (node_name, objects, start, end, only_arrows) {
		for (var index = 0; index < 2; ++index) {
			var i = index * 2,
				j = i + 1,
				x1 = start[i],
				y1 = start[j],
				x2 = end[i],
				y2 = end[j],
				object = objects[index],
				nodes = document.querySelectorAll(".preview>.trajectories>.object" + (index + 1) + "." + node_name),
				arrows = [],
				path, n;

			path = [
				"M", x1, y1, "L", x2, y2,
				"M", x1 + object.width, y1, "L", x2 + object.width, y2,
				"M", x1, y1 + object.height, "L", x2, y2 + object.height,
				"M", x1 + object.width, y1 + object.height, "L", x2 + object.width, y2 + object.height,
			].join(" ");

			for (i = 0; i < nodes.length; ++i) {
				n = nodes[i];
				if (has_class(n, "arrow")) {
					arrows.push(n);
				}
				else if (!only_arrows) {
					n.setAttribute("d", path);
					remove_class(n, "hidden");
				}
			}

			path = [
				"M", x1 + object.width / 2, y1 + object.height / 2, "L", x2 + object.width / 2, y2 + object.height / 2,
			].join(" ");

			for (i = 0; i < arrows.length; ++i) {
				arrows[i].setAttribute("d", path);
				remove_class(arrows[i], "hidden");
			}
		}
	};
	display.update_size = function (objects) {
		var stroke_width = 1;

		display.foreach(document, ".preview>.fills>*", function (index) {
			this.setAttribute("width", objects[index].width);
			this.setAttribute("height", objects[index].height);
		});
		display.foreach(document, ".preview>.outlines>*", function (index) {
			this.setAttribute("width", objects[index].width - stroke_width);
			this.setAttribute("height", objects[index].height - stroke_width);
		});
	};
	display.setup_events = function (objects) {
		var modifying = null,
			events;

		// Functions
		var hook_mouse_events = function () {
			document.addEventListener("mousemove", on_mousemove, false);
			document.addEventListener("mouseup", on_mouseup, false);
		};
		var on_mousemove = function (event) {
			var rect = get_object_rect(modifying[2]),
				object = objects[modifying[0]],
				x = Math.max(0, Math.min(rect.width - object.width, event.pageX - rect.left - object.width / 2)),
				y = Math.max(0, Math.min(rect.height - object.height, event.pageY - rect.top - object.height / 2));

			if (modifying[1]) {
				object.speed.x = x - object.x;
				object.speed.y = y - object.y;
			}
			else {
				object.speed.x += object.x - x;
				object.speed.y += object.y - y;
				object.x = x;
				object.y = y;
			}

			update_position_info(modifying[0], modifying[1], x, y);
			update(objects, false);
		};
		var on_mouseup = function () {
			document.removeEventListener("mousemove", on_mousemove, false);
			document.removeEventListener("mouseup", on_mouseup, false);
			modifying = null;
		};

		// Available events
		events = {
			move_start: function (index, parent, event) {
				if (event.which !== 1) return;

				modifying = [ index, false, parent ];
				hook_mouse_events();

				event.preventDefault();
				event.stopPropagation();
				return false;
			},
			move_end: function (index, parent, event) {
				if (event.which !== 1) return;

				modifying = [ index, true, parent ];
				hook_mouse_events();

				event.preventDefault();
				event.stopPropagation();
				return false;
			}
		};

		// Nodes
		display.foreach(document, ".preview>.fills>.events[data\\:event]", function (index) {
			var event = (this.getAttribute("data:event") || "");
			if (event in events) {
				this.addEventListener("mousedown", bind(events[event], this, index, find_svg_parent(this)), false);
			}
		});
	};

	var update = function (objects, no_update_url) {
		var data = [ null, null, null, null, null ];
		var callback = function (type) {
			data[type] = Array.prototype.slice.call(arguments, 1);
		};
		new Collision().test(objects[0], objects[1], callback);

		// Display
		display(objects, data);

		// Update url
		if (!no_update_url) {
			update_url(objects[0], objects[1]);
		}
	};
	var update_position_info = function (object_index, is_end, x, y) {
		++object_index;
		is_end = is_end ? 2 : 1;

		var n;
		if ((n = document.querySelector(".object_modify.object" + object_index + "_modify_x" + is_end)) !== null) {
			n.value = x;
		}
		if ((n = document.querySelector(".object_modify.object" + object_index + "_modify_y" + is_end)) !== null) {
			n.value = y;
		}
	};

	var objects = [
		{
			x: 300,
			y: 40,
			width: 60,
			height: 60,
			speed: { x: 340, y: 300 },
			weight: 1,
			weight_transfer: 1,
			weight_accept: 1,
			motion_transfer: 1, // amount of motion that can be transferred to other objects (in the range of [0, 1])
			motion_accept: 1, // amount of motion that can be transferred FROM other objects
		},
		{
			x: 640,
			y: 40,
			width: 60,
			height: 60,
			speed: { x: -480, y: 400 },
			weight: 1,
			movable: true,
			weight_transfer: 1,
			weight_accept: 1,
			motion_transfer: 1,
			motion_accept: 1,
		}
	];

	on_ready(function () {
		load_from_url(objects[0], objects[1]);
		display.setup_events(objects);
		display.update_size(objects);

		update(objects, true);

		var nodes = document.querySelectorAll("input.object_modify[type=text]"),
			target, i, j, val, extra;

		for (i = 0; i < nodes.length; ++i) {
			target = (nodes[i].getAttribute("data-target") || "").split(";");
			target[0] = target[0].split(",");
			j = parseInt(target[0][0], 10) || 0;
			val = target[0].slice(1);
			if (j >= 0 && j < objects.length) {
				setup_input_change(nodes[i], objects[j], val, target.length > 1 ? target[1] : null);
			}
		}
	});

})();


