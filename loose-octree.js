(function () {
	"use strict";

	var w = {};
	try {
		w = window;
	}
	catch (e) {}

	var Tree = (function () {

		var Tree = function (x, y, width, height, padding, max_objects, max_depth, cols, rows, parent) {
			var p = 1 + 2 * padding,
				n1, n2, n3, n4;

			this.padding = padding;

			this.left = x - padding * width;
			this.top = y - padding * height;
			this.right = x + (1 + padding) * width;
			this.bottom = y + (1 + padding) * height;
			this.width = width;
			this.height = height;

			this.rows = rows;
			this.cols = cols;
			this.rows_minus_1 = rows - 1;
			this.cols_minus_1 = cols - 1;
			this.sub_width = width / cols;
			this.sub_height = height / rows;
			this.sub_width_full = this.sub_width * p;
			this.sub_height_full = this.sub_height * p;

			p = padding * width / cols;
			this.inner_left = x - p;
			this.inner_top = y - p;
			p *= 2;
			this.inner_width = width + p;
			this.inner_height = height + p;

			this.children = null;
			this.objects_first = [ (n1 = new Node(null)) , (n3 = new Node(null)) ]; // can-be-deeper, cannot-be-deeper, outer-intersect, outer
			this.objects_last = [ (n2 = new Node(null)) , (n4 = new Node(null)) ];
			n1.next = n2;
			n2.prev = n1;
			n3.next = n4;
			n4.prev = n3;

			this.counts = [ 0, 0 ];
			this.count = 0;
			this.count_total = 0;
			this.count_next = 0;
			this.query_index = 0; // member, since no thread safety is required
			this.query_index_max = 0;

			if (parent === undefined) {
				this.parent = { count_next: 0 };
				this.objects_first.push((n1 = new Node(null)), (n3 = new Node(null)));
				this.objects_last.push((n2 = new Node(null)), (n4 = new Node(null)));
				n1.next = n2;
				n2.prev = n1;
				n3.next = n4;
				n4.prev = n3;
				this.counts.push(0, 0);
			}
			else {
				this.parent = parent;
			}

			this.max_objects = max_objects;
			this.max_depth = max_depth;
		};

		Tree.prototype = {
			constructor: Tree,
			insert: function (obj) {
				var n = new Node(obj);
				insert_internal.call(null, this, obj, n);
				++this.count_total;
				return n;
			},
			update: function (node) {
				// TODO : Re-calculate bounds, and check if it still nicely fits inside the same tree node
				// if not, then re-insert the node (without deleting the node)
			},
			query: function (bbox) {
				var results = [];

				if (contains.call(this, bbox)) {
					search.call(null, this, bbox, results);
					search_list.call(null, this.objects_first[2].next, this.objects_last[2], bbox, results);
				}
				else if (intersects.call(this, bbox)) {
					search.call(null, this, bbox, results);
					search_list.call(null, this.objects_first[2].next, this.objects_last[2], bbox, results);
					search_list.call(null, this.objects_first[3].next, this.objects_last[3], bbox, results);
				}
				else {
					search_list.call(null, this.objects_first[2].next, this.objects_last[2], bbox, results);
					search_list.call(null, this.objects_first[3].next, this.objects_last[3], bbox, results);
				}

				return results;
			},
			subdivide: function (next_cols, next_rows) {
				if (this.children === null) {
					if (!next_cols) next_cols = 2;
					if (!next_rows) next_rows = 2;
					if (next_rows > 0 && next_rows > 0) {
						subdivide.call(this, next_cols, next_rows);
						return true;
					}
				}
				return false;
			},
			size: function () {
				return this.count_total;
			},
			repr: function () {
				return repr.call(this, "", true);
			}
		};

		var contains = function (bbox) {
			return (
				bbox.left >= this.left &&
				bbox.right < this.right &&
				bbox.top >= this.top &&
				bbox.bottom < this.bottom
			);
		};
		var intersects = function (bbox) {
			return (
				bbox.left < this.right &&
				bbox.right >= this.left &&
				bbox.top < this.bottom &&
				bbox.bottom >= this.top
			);
		};
		var intersects_object = function (bbox) {
			return (
				bbox.left < this.right &&
				bbox.right >= this.left &&
				bbox.top < this.bottom &&
				bbox.bottom >= this.top
			);
		};

		var search = function (tree, bbox, results) {
			var root = tree.parent,
				t;

			// this.query_index_max
			tree.query_index = 0;
			tree.query_index_max = (tree.count_next > 0 ? tree.children.length : 0);

			loop1:
			while (tree !== root) {
				// Check entries
				if (tree.query_index === 0) {
					search_list.call(null, tree.objects_first[0].next, tree.objects_last[0], bbox, results);
					search_list.call(null, tree.objects_first[1].next, tree.objects_last[1], bbox, results);
				}

				// Loop across children
				while (tree.query_index < tree.query_index_max) {
					t = tree.children[tree.query_index];
					++tree.query_index;

					if (t.count > 0 && intersects.call(t, bbox)) {
						tree = t;
						tree.query_index = 0;
						tree.query_index_max = (tree.count_next > 0 ? tree.children.length : 0);
						continue loop1;
					}
				}

				// Move to parent
				tree = tree.parent;
			}
		};
		var search_list = function (n, n_last, bbox, results) {
			for (; n !== n_last; n = n.next) {
				if (intersects_object.call(n.object, bbox) && bbox !== n.object) {
					results.push(n.object);
				}
			}
		};

		var insert_internal = function (tree, obj, node) {
			var index = 0,
				x, y;

			if (contains.call(tree, obj)) {
				while (true) {
					if (tree.counts[0] < tree.max_objects || tree.max_depth <= 0) {
						// No need to subdivide
						break; // index = 0;
					}

					// Inner check
					x = obj.left - tree.inner_left;
					y = obj.top - tree.inner_top;
					if (x < 0 || y < 0 || x >= tree.inner_width || y >= tree.inner_height) {
						// Cannot subdivide
						index = 1;
						break;
					}

					// Subdivide check
					x = Math.min(Math.floor(x / tree.sub_width), tree.cols_minus_1);
					y = Math.min(Math.floor(y / tree.sub_height), tree.rows_minus_1);
					if (
						obj.right >= tree.left + x * tree.sub_width + tree.sub_width_full ||
						obj.bottom >= tree.top + y * tree.sub_height + tree.sub_height_full
					) {
						// Cannot subdivide
						index = 1;
						break;
					}

					// Subdivide
					if (tree.children === null) subdivide.call(tree, 2, 2);
					tree = tree.children[y * tree.cols + x];
				}

				++tree.count;
				++tree.parent.count_next;
			}
			else {
				// Doesn't fit inside map
				index = intersects.call(tree, obj) ? 2 : 3;
			}

			// Add
			node.link(tree.objects_last[index], tree, index);
			++tree.counts[index];
			return node;
		};
		var subdivide = function (next_cols, next_rows) {
			var left = this.left + this.width * this.padding,
				top = this.top + this.height * this.padding,
				w = this.sub_width,
				h = this.sub_height,
				x, y, t;

			this.children = [];

			for (y = 0; y < this.rows; ++y) {
				for (x = 0; x < this.cols; ++x) {
					t = new Tree(
						left + x * w,
						top + y * h,
						w,
						h,
						this.padding,
						this.max_objects,
						this.max_depth - 1,
						next_cols,
						next_rows,
						this
					);
					this.children.push(t);
				}
			}
		};

		var repr = function (indent, full) {
			var nl = "\n  " + indent,
				result, s, i;

			result = "{" + nl + "rect: [" + this.left + ", " + this.top + ", " + (this.width * (1 + 2 * this.padding)) + ", " + (this.height * (1 + 2 * this.padding)) + "],";

			s = repr_list.call(this, this.objects_first[0], this.objects_last[0]);
			result += nl + "can_be_deeper: [" + s + "],";

			s = repr_list.call(this, this.objects_first[1], this.objects_last[1]);
			result += nl + "cannot_be_deeper: [" + s + "],";

			if (this.children === null) {
				s = "null";
			}
			else {
				s = [];
				for (i = 0; i < this.children.length; ++i) {
					s.push(repr.call(this.children[i], indent + "    ", false));
				}
				s = "[" + nl + "  " + s.join("," + nl + "  ") + nl + "]";
			}
			result += nl + "children: " + s;

			if (full) {
				s = repr_list.call(this, this.objects_first[2], this.objects_last[2]);
				result += "," + nl + "outer_intersect: [" + s + "],";

				s = repr_list.call(this, this.objects_first[3], this.objects_last[3]);
				result += nl + "outer: [" + s + "],";

				result += nl + "size: " + this.count_total;
			}

			result += "\n" + indent + "}";

			return result;
		};
		var repr_list = function (first, last) {
			var s = [];
			for (first = first.next; first !== last; first = first.next) {
				s.push(" " + JSON.stringify(first.object) + " ");
			}
			return s.join(", ");
		};

		var Node = function (object) {
			this.prev = null;
			this.next = null;
			this.object = object;
			this.parent = null;
			this.list_index = 0;
		};
		Node.prototype = {
			constructor: Node,
			link: function (next, parent, list_index) {
				this.prev = next.prev;
				this.next = next;

				this.prev.next = this;
				next.prev = this;

				this.parent = parent;
				this.list_index = list_index;
			},
			remove: function () {
				this.prev.next = this.next;
				this.next.prev = this.prev;
				this.prev = null;
				this.next = null;

				var tree = this.parent;
				--tree.counts[this.list_index];
				if (tree.count === 1 && tree.count_next > 0) {
					var children, i, n, n_next;

					break_all:
					while (true) {
						children = tree.children;
						for (i = 0; i < children.length; ++i) {
							tree = children[i];
							if (tree.count > 0) {
								if (tree.count_next === 0) break break_all;
								break;
							}
						}
					}

					// Unlink
					i = (tree.counts[1] > 0 ? 1 : 0);
					n = tree.objects_last[i].prev;
					--tree.count;
					--tree.counts[i];
					--tree.parent.count_next;
					n.prev.next = n.next;
					n.next.prev = n.prev;

					// Re-link node to new parent
					tree = this.parent;
					n_next = tree.objects_last[0];
					n.list_index = 0;
					n.parent = tree;
					n.next = n_next;
					n.prev = n_next.prev;
					n_next.prev.next = n;
					n_next.prev = n;
					++tree.counts[0];
				}
				else {
					--tree.count;
					--tree.parent.count_next;
				}
				this.parent = null;
			}
		};

		return Tree;

	})();

	w.Tree = Tree;

})();

