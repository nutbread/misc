(function () {
	"use strict";

	var random = function (min, max) {
		return min + Math.random() * (max - min);
	};
	var create_random = function () {
		var w = random(32, 32),
			h = random(32, 32),
			x = random(0, width - w),
			y = random(0, height - h);

		return {
			left: x,
			top: y,
			right: x + w,
			bottom: y + h,
			touching: false,
			id: create_random.id++
		};
	};
	create_random.id = 0;

	var visualize_regions = function (tree) {
		var n1 = document.createElement("div"),
			n2 = document.createElement("div"),
			p = "-" + (tree.padding * 100) + "%",
			x, y, c, n3, n4;

		n1.className = "tree";

		n2.className = "tree_bbox";
		n2.setAttribute("style", "left:" + p + ";top:" + p + ";right:" + p + ";bottom:" + p + ";");

		n1.appendChild(n2);

		//if (tree.children !== null) {
		if (tree.count_next > 0) {
			for (y = 0; y < tree.rows; ++y) {
				for (x = 0; x < tree.rows; ++x) {
					c = tree.children[y * tree.rows + x];
					n3 = document.createElement("div");
					n3.setAttribute("style", "position:absolute;left:" + (x / tree.cols * 100) + "%;top:" + (y / tree.rows * 100) + "%;width:" + (1 / tree.cols * 100) + "%;height:" + (1 / tree.rows * 100) + "%;");
					n4 = visualize_regions(c);
					if (((x + y) % 2) === 1) n4.classList.add("alt");
					n3.appendChild(n4);
					n1.appendChild(n3);
				}
			}
		}

		return n1;
	};
	var visualize = function (parent, tree) {
		parent.style.width = width + "px";
		parent.style.height = height + "px";
		parent.innerHTML = "";
		parent.appendChild(visualize_regions(tree));

		var n1 = document.createElement("div"),
			n2, i, o;

		n1.className = "overlay";

		for (i = 0; i < objects.length; ++i) {
			o = objects[i][0];
			n2 = document.createElement("div");
			n2.className = "object";
			n2.setAttribute("style", "left:" + (o.left / width * 100) + "%;top:" + (o.top / height * 100) + "%;width:" + ((o.right - o.left) / width * 100) + "%;height:" + ((o.bottom - o.top) / height * 100) + "%;");
			n1.appendChild(n2);

			if (o.touching) n2.classList.add("touching");

			n2.textContent = objects[i][1].list_index;
		}

		parent.appendChild(n1);
	};


	var size_div = document.querySelector("#main"),
		width = 400,
		height = 400,
		tree = new Tree(0, 0, width, height, 0.25, 1, 8, 2, 2),
		objects = [],
		i, j, o, nodes;


	// Setup
	for (i = 0; i < 50; ++i) {
		o = create_random();
		objects.push([ o, tree.insert(o) ]);
	}

	for (i = 0; i < objects.length; ++i) {
		o = objects[i][0];
		nodes = tree.query(o);
		if (nodes.length > 0) {
			for (j = 0; j < nodes.length; ++j) {
				nodes[j].touching = true;
			}
		}
	}

	// Display
	visualize(size_div, tree);
})();


