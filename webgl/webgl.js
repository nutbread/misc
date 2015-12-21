// http://www.opengl.org.ru/docs/pg/0208.html
// https://web.archive.org/web/20120527185124/http://cgg-journal.com/2008-2/06/index.html
// http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
// http://orbit.dtu.dk/fedora/objects/orbit:55459/datastreams/file_3735323/content
// http://voxelent.com/html/beginners-guide/chapter_3/ch3_Sphere_Phong.html
// http://gafferongames.com/game-physics/physics-in-3d/
// http://www.shadedrelief.com/natural3/index.html
// http://codeflow.org/entries/2013/feb/22/how-to-write-portable-webgl/
(function () {
	"use strict";

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

				// Clear callbacks, events, checking interval
				callbacks = null;

				window.removeEventListener("load", callback_check, false);
				window.removeEventListener("DOMContentLoaded", callback_check, false);
				document.removeEventListener("readystatechange", callback_check, false);

				if (check_interval !== null) {
					clearInterval(check_interval);
					check_interval = null;
				}

				// Run callbacks
				for (i = 0; i < cb_count; ++i) {
					cbs[i].call(null);
				}

				// Okay
				return true;
			}

			// Not executed
			return false;
		};

		// Listen
		window.addEventListener("load", callback_check, false);
		window.addEventListener("DOMContentLoaded", callback_check, false);
		document.addEventListener("readystatechange", callback_check, false);

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


	var rand_color = function () {
		return [ 160, 200, 255, 255 ];
		/*return [
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			Math.floor(Math.random() * 256),
			255
		];*/
	};


	var vectors_equal = function (v1, v2) {
		return (
			Math.abs(v1[0] - v2[0]) < 1e-10 &&
			Math.abs(v1[1] - v2[1]) < 1e-10 &&
			Math.abs(v1[2] - v2[2]) < 1e-10
		);
	};

	var add_vertex = function (all, vec) {
		for (var i = 0; i < all.length; ++i) {
			if (vectors_equal(vec, all[i])) return i;
		}

		all.push(vec);
		return all.length - 1;
	};

	var get_normal = function (out, v1, v2, v3) {
		v2 = vec3.subtract(vec3.create(), v2, v1);
		v3 = vec3.subtract(vec3.create(), v3, v1);

		out[0] = v2[1] * v3[2] - v2[2] * v3[1];
		out[1] = v2[2] * v3[0] - v2[0] * v3[2];
		out[2] = v2[0] * v3[1] - v2[1] * v3[0];
		vec3.normalize(out, out);
	};

	var subdivide_icosahedron = function (icosahedron, subdivisions) {
		var new_vertices = [],
			new_indices = [],
			indices = icosahedron.indices,
			index_count = indices.length,
			new_verts = new Uint16Array(1 + subdivisions * (subdivisions + 3) / 2),
			a, v, v1, v2, v3, i, j, jj, k, kk;

		for (i = 0; i < index_count; i += 3) {
			v1 = vec3.clone(icosahedron.vertices[indices[i]]);
			v2 = vec3.clone(icosahedron.vertices[indices[i + 1]]);
			v3 = vec3.clone(icosahedron.vertices[indices[i + 2]]);
			vec3.subtract(v2, v2, v1);
			vec3.subtract(v3, v3, v1);

			a = 0;
			for (j = 0; j <= subdivisions; ++j) {
				jj = j / subdivisions;
				for (k = 0, kk = subdivisions - j; k <= kk; ++k) {
					v = vec3.clone(v1);
					vec3.scaleAndAdd(v, v, v2, jj);
					vec3.scaleAndAdd(v, v, v3, k / subdivisions);
					vec3.normalize(v, v);
					new_verts[a] = add_vertex(new_vertices, v);
					++a;
				}
			}

			a = 0;
			for (j = 0; j < subdivisions; ++j) {
				for (k = 0, kk = subdivisions - j; k < kk; ++k) {
					++a;
					new_indices.push(new_verts[a - 1], new_verts[a + kk], new_verts[a]);
				}
				a -= kk;
				for (k = 1; k < kk; ++k) {
					++a;
					new_indices.push(new_verts[a], new_verts[a + kk], new_verts[a + 1 + kk]);
				}
				a += 2;
			}
		}

		return {
			vertices: new_vertices,
			indices: new_indices
		};
	};


	var Polygon = function (arraybuffer, pos, stride, v1, v2, v3, color, tex_map) {
		var c, i, v, x, y;

		// Texture map
		if (tex_map) {
			v = vec3.clone(v1);
			vec3.add(v, v, v2);
			vec3.add(v, v, v3);
			vec3.divide(v, v, [ 3.0, 3.0, 3.0 ]);

			x = Math.atan2(v[1], -v[0]);
			y = Math.asin(v[2]) / Math.PI + 0.5;

			if (x < 0.0) x += Math.PI * 2.0;
			x /= Math.PI * 2.0;

			x = Math.max(0, Math.min(tex_map.width - 1, Math.floor(x * tex_map.width)));
			y = Math.max(0, Math.min(tex_map.height - 1, Math.floor(y * tex_map.height)));

			c = tex_map.context.getImageData(x, y, 1, 1).data;
			color[0] = c[0];
			color[1] = c[1];
			color[2] = c[2];
			color[3] = 255;
		}

		// Vertices
		this.vertices = [
			new Float32Array(arraybuffer, pos, 3),
			new Float32Array(arraybuffer, pos + stride, 3),
			new Float32Array(arraybuffer, pos + stride * 2, 3),
		];
		pos += 3 * 4;
		vec3.copy(this.vertices[0], v1);
		vec3.copy(this.vertices[1], v2);
		vec3.copy(this.vertices[2], v3);

		// Vertex normals
		this.vertex_normals = [
			new Float32Array(arraybuffer, pos, 3),
			new Float32Array(arraybuffer, pos + stride, 3),
			new Float32Array(arraybuffer, pos + stride * 2, 3),
		];
		pos += 3 * 4;
		vec3.normalize(this.vertex_normals[0], v1);
		vec3.normalize(this.vertex_normals[1], v2);
		vec3.normalize(this.vertex_normals[2], v3);

		// Polygon normals
		this.polygon_normals = [
			(v = new Float32Array(arraybuffer, pos, 3)),
			new Float32Array(arraybuffer, pos + stride, 3),
			new Float32Array(arraybuffer, pos + stride * 2, 3),
		];
		pos += 3 * 4;
		get_normal(v, v1, v2, v3);
		vec3.copy(this.polygon_normals[1], v);
		vec3.copy(this.polygon_normals[2], v);

		// Color
		this.colors = [
			new Uint8Array(arraybuffer, pos, 4),
			new Uint8Array(arraybuffer, pos + stride, 4),
			new Uint8Array(arraybuffer, pos + stride * 2, 4),
		];
		pos += 4;
		for (i = 0; i < this.colors.length; ++i) {
			c = this.colors[i];
			c[0] = color[0];
			c[1] = color[1];
			c[2] = color[2];
			c[3] = color[3];
		}

		// Barycentric coordinate
		(new Uint8Array(arraybuffer, pos, 1))[0] = 1;
		pos += stride + 1;
		(new Uint8Array(arraybuffer, pos, 1))[0] = 1;
		pos += stride + 1;
		(new Uint8Array(arraybuffer, pos, 1))[0] = 1;
	};


	var create_icosahedron = (function () {

		var X = 0.525731112119133606, // Math.sqrt(2 / (5 + Math.sqrt(5))),
			Z = 0.850650808352039932, // Math.sqrt((5 + Math.sqrt(5)) / 10),
			vertices = [
				[-X, 0.0, Z], [X, 0.0, Z], [-X, 0.0, -Z], [X, 0.0, -Z],
				[0.0, Z, X], [0.0, Z, -X], [0.0, -Z, X], [0.0, -Z, -X],
				[Z, X, 0.0], [-Z, X, 0.0], [Z, -X, 0.0], [-Z, -X, 0.0]
			],
			indices = [
				1,4,0,   4,9,0,   4,5,9,   8,5,4,   1,8,4,
				1,10,8,  10,3,8,  8,3,5,   3,2,5,   3,7,2,
				3,10,7,  10,6,7,  6,11,7,  6,0,11,  6,1,0,
				10,1,6,  11,0,9,  2,11,9,  5,2,9,   11,2,7
			];

		return function () {
			var vert = [],
				ind = indices.slice(0),
				i;

			for (i = 0; i < vertices.length; ++i) {
				vert.push(vertices[i].slice(0));
			}

			return {
				vertices: vert,
				indices: ind
			};
		};

	})();

	var create_sphere = function (gl, subdivisions, tex_map) {
        var sphere = subdivide_icosahedron(create_icosahedron(), subdivisions),
			vertex_stride = (9 * 4 + 4 * 1 + 1 * 4),
			pos = 0,
			vertex_buffer = gl.createBuffer(),
			indices = sphere.indices,
			vertices = sphere.vertices,
			index_count = indices.length,
			buffer = new ArrayBuffer(index_count * vertex_stride),
			polygons = [],
			poly, i;


		for (i = 0; i < index_count; i += 3) {
			poly = new Polygon(
				buffer,
				pos,
				vertex_stride,
				vertices[indices[i]],
				vertices[indices[i + 1]],
				vertices[indices[i + 2]],
				rand_color(),
				tex_map
			);

			polygons.push(poly);

			pos += vertex_stride * 3;
		}


        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
		// index_count -= 340; buffer = buffer.slice(0, index_count * vertex_stride);
        gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.DYNAMIC_DRAW);


		return {
			vertex_buffer: vertex_buffer,
			array_buffer: buffer,
			polygons: polygons,
			size: index_count
		}
	};

	var create_shader = function (gl, type, source) {
		var shader = gl.createShader(type);

		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error(gl.getShaderInfoLog(shader));
		}

		return shader;
	};

	var create_shader_program = function (gl, fragment, vertex) {
		var fragment_shader = create_shader(gl, gl.FRAGMENT_SHADER, fragment),
			vertex_shader = create_shader(gl, gl.VERTEX_SHADER, vertex),
			program;

		program = gl.createProgram();
		gl.attachShader(program, vertex_shader);
		gl.attachShader(program, fragment_shader);
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error("Could not create shader program");
		}

		return program;
	};


	var webgl_get_context = function (canvas, settings) {
		var gl = null;
		try {
			gl = canvas.getContext("webgl", settings) || canvas.getContext("experimental-webgl", settings);
		}
		catch (e) {}
		return gl || null;
	};


	var render = function (gl, w, h, earth) {
		var shape = create_sphere(gl, 7, earth);

		gl.getExtension("OES_standard_derivatives");

		// Shader
		var shader_program = create_shader_program(gl, //{
			[
				"#ifdef GL_OES_standard_derivatives\n",
				"#extension GL_OES_standard_derivatives : enable\n",
				"#endif\n",
				"precision mediump float;",

				"uniform sampler2D texture;",
				"uniform vec4 texture_rect;",

				"varying lowp vec4 color;",
				"varying vec3 v_normal;",
				"varying vec3 p_normal;",
				"varying vec3 barycentric_coord;",
				"varying vec3 eye_vector;",

				"float line_factor(float size) {",
					"vec3 s = clamp((vec3(1.0) - barycentric_coord) * 2.0, 0.0, 1.0);",
					"float scale = min(min(s.x, s.y), s.z);",
					"scale = sqrt(scale);",
					"size *= (1.0 - scale * 0.75);",
				"\n#ifdef GL_OES_standard_derivatives\n",
					//"vec3 d = fwidth(barycentric_coord);", // This has a bug on android
					//"vec3 d = abs(dFdx(barycentric_coord)) + abs(dFdy(barycentric_coord));",
					"vec3 d = abs(vec3(dFdx(barycentric_coord.x), dFdx(barycentric_coord.y), dFdx(barycentric_coord.z))) + abs(vec3(dFdy(barycentric_coord.x), dFdy(barycentric_coord.y), dFdy(barycentric_coord.z)));",
					"vec3 factor = barycentric_coord / d / size;", // smoothstep
				"\n#else\n",
					"vec3 factor = barycentric_coord / size * 100.0;", // smoothstep
				"\n#endif\n",
					"factor = clamp(factor, 0.0, 1.0);",
					"factor = factor * factor;",
					"factor = factor * factor;",
					"float f1 = min(min(factor.x, factor.y), factor.z);",
					"return f1;",
//					"return (1.0 - (1.0 - f1) * (1.0 - scale));",
				"}",

				"vec3 light_normal = vec3(0.0, 0.7071067811865475, 0.7071067811865475);",
//				"vec3 light_normal = vec3(0.0, 0.0, -1.0);",
//				"vec3 light_normal = vec3(0.0, 0.0, 1.0);",
//				"vec3 light_normal = vec3(0.0, 0.7071067811865475, 0.7071067811865475);",
				"void main(void) {",
					"vec3 light_normal_fixed = -light_normal;", // normalize() not needed
					"vec3 eye_vector_fixed = normalize(eye_vector);",
					"vec3 v_normal_fixed = normalize(v_normal);",
					"float diffuse_poly = clamp(dot(p_normal, light_normal), 0.0, 1.0);",
					"float diffuse_outline = clamp(dot(v_normal_fixed, light_normal), 0.0, 1.0);",
					"float specular_poly = pow(max(dot(reflect(light_normal_fixed, p_normal), eye_vector_fixed), 0.0), 10.0) * diffuse_poly;",
					"float specular_outline = pow(max(dot(reflect(light_normal_fixed, v_normal_fixed), eye_vector_fixed), 0.0), 10.0) * diffuse_outline;",
					"diffuse_outline = diffuse_outline * 0.75 + 0.25;",
					"specular_poly *= 0.125;",
					"vec3 outline_color = vec3(1.0, 1.0, 1.0) * diffuse_outline + vec3(1.0, 1.0, 1.0) * specular_outline;",
					"vec2 tex_coord = vec2(",
						"gl_FragCoord.x * texture_rect[2] + texture_rect[0],",
						"gl_FragCoord.y * texture_rect[3] + texture_rect[1]",
					");",
					"vec3 tex_color = texture2D(texture, tex_coord).rgb;",
					"float tex_factor = 0.25;",
					"vec3 poly_color = (color.rgb * (1.0 - tex_factor) + tex_color * tex_factor) * diffuse_poly + vec3(1.0, 1.0, 1.0) * specular_poly;",
					"vec4 frag_color = mix(vec4(outline_color, 1.0), vec4(poly_color, color.a), line_factor(3.0));",
					"gl_FragColor = frag_color;",
				"}",
			].join(""),
			[
				"attribute vec3 vertex;",
				"attribute vec3 vertex_normal;",
				"attribute vec4 vertex_color;",
				"attribute vec3 poly_normal;",
				"attribute vec3 poly_barycentric_coord;",

				"varying lowp vec4 color;",
				"varying vec3 v_normal;",
				"varying vec3 p_normal;",
				"varying vec3 barycentric_coord;",
				"varying vec3 eye_vector;",

				"uniform mat4 modelview_matrix;",
				"uniform mat4 projection_matrix;",
				"uniform mat3 normal_matrix;",

				"void main(void) {",
					"vec4 world_vertex = modelview_matrix * vec4(vertex, 1.0);",
					"gl_Position = projection_matrix * world_vertex;",
					"p_normal = normal_matrix * poly_normal;",
					"v_normal = normal_matrix * vertex_normal;", // "normal = vec3(modelview_matrix * vec4(vertex_normal, 0.0));",
					"barycentric_coord = poly_barycentric_coord;",
					"eye_vector = -vec3(world_vertex);",
					"color = vertex_color;",
				"}",
			].join("")
		); //}

		gl.useProgram(shader_program);

		shader_program.attr_vertex = gl.getAttribLocation(shader_program, "vertex");
		shader_program.attr_vertex_normal = gl.getAttribLocation(shader_program, "vertex_normal");
		shader_program.attr_vertex_color = gl.getAttribLocation(shader_program, "vertex_color");
		shader_program.attr_poly_normal = gl.getAttribLocation(shader_program, "poly_normal");
		shader_program.attr_poly_barycentric_coord = gl.getAttribLocation(shader_program, "poly_barycentric_coord");

		gl.enableVertexAttribArray(shader_program.attr_vertex);
		gl.enableVertexAttribArray(shader_program.attr_vertex_normal);
		gl.enableVertexAttribArray(shader_program.attr_vertex_color);
		gl.enableVertexAttribArray(shader_program.attr_poly_normal);
		gl.enableVertexAttribArray(shader_program.attr_poly_barycentric_coord);

		shader_program.projection_matrix = gl.getUniformLocation(shader_program, "projection_matrix");
		shader_program.modelview_matrix = gl.getUniformLocation(shader_program, "modelview_matrix");
		shader_program.normal_matrix = gl.getUniformLocation(shader_program, "normal_matrix");
		shader_program.texture_rect = gl.getUniformLocation(shader_program, "texture_rect");
		shader_program.texture = gl.getUniformLocation(shader_program, "texture");


		// Texture
		var tex = gl.createTexture();
		var video = document.querySelector("video");
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		var update_texture = function () {
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
			gl.bindTexture(gl.TEXTURE_2D, null);

			var scales = [ video.videoWidth / video.videoHeight, w / h ],
				i = (scales[0] > scales[1] ? 0 : 1),
				v = (1 - scales[1 - i] / scales[i]) / 2;

			tex_rect = new Float32Array([ 0, 0, 1, 1 ]);
			tex_rect[i] = v;
			tex_rect[i + 2] = 1 - v * 2;
			tex_rect[2] /= w; // normalize to the viewport
			tex_rect[3] /= h;
		};
		setTimeout(update_texture, 1000);


		// Settings
		gl.viewport(0, 0, w, h);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.BLEND);
		gl.cullFace(gl.BACK);
		gl.enable(gl.DEPTH_TEST); // Enable depth testing
		gl.depthFunc(gl.LEQUAL); // Near things obscure far things


		var tex_rect = new Float32Array([ 0, 0, 1, 1 ]);
		var bg_color = new Float32Array([ 0, 0, 0, 1 ]);


		var modelview_matrix = mat4.create(),
			projection_matrix = mat4.create(),
			normal_matrix = mat3.create();

		var rot = 0.0;
		var tick = window.performance.now();
		var fn = function () {
			var tick_next = window.performance.now(),
				delta = (tick_next - tick) / 1000.0;

			tick = tick_next;

			update_texture();

			gl.clearColor(bg_color[0], bg_color[1], bg_color[2], bg_color[3]); // Set clear color to black, fully opaque
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // Clear the color as well as the depth buffer.


			mat4.perspective(projection_matrix, 45, w / h, 0.1, 100.0);
			gl.uniformMatrix4fv(shader_program.projection_matrix, false, projection_matrix);


			mat4.identity(modelview_matrix);
			mat4.translate(modelview_matrix, modelview_matrix, [ 0.0, 0.0, -2.5 ]);
			mat4.rotateX(modelview_matrix, modelview_matrix, Math.PI / 2.0);
			mat4.rotateY(modelview_matrix, modelview_matrix, -(23.4 / 180.0) * Math.PI);
			mat4.rotateZ(modelview_matrix, modelview_matrix, rot);
//			mat4.rotateY(modelview_matrix, modelview_matrix, rot / 2.0);
			//mat4.rotateX(modelview_matrix, modelview_matrix, rot);
			mat3.fromMat4(normal_matrix, modelview_matrix);
			mat3.invert(normal_matrix, normal_matrix);
			mat3.transpose(normal_matrix, normal_matrix);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.uniform1i(shader_program.texture, 0);
			gl.uniform4fv(shader_program.texture_rect, tex_rect);

			gl.bindBuffer(gl.ARRAY_BUFFER, shape.vertex_buffer);
			gl.vertexAttribPointer(shader_program.attr_vertex, 3, gl.FLOAT, false, 4 * 11, 0);
			gl.vertexAttribPointer(shader_program.attr_vertex_normal, 3, gl.FLOAT, false, 4 * 11, 4 * 3);
			gl.vertexAttribPointer(shader_program.attr_poly_normal, 3, gl.FLOAT, false, 4 * 11, 4 * 6);
			gl.vertexAttribPointer(shader_program.attr_vertex_color, 4, gl.UNSIGNED_BYTE, true, 4 * 11, 4 * 9);
			gl.vertexAttribPointer(shader_program.attr_poly_barycentric_coord, 3, gl.UNSIGNED_BYTE, false, 4 * 11, 4 * 10);
			gl.uniformMatrix4fv(shader_program.modelview_matrix, false, modelview_matrix);
			gl.uniformMatrix3fv(shader_program.normal_matrix, false, normal_matrix);
			gl.drawArrays(gl.TRIANGLES, 0, shape.size);


			rot += 0.25 * delta;
			setTimeout(fn, 16);
		};

		fn();
	};


	var pre_init = function () {
		var img = new Image();
		img.addEventListener("load", function () {
			var canvas = document.createElement("canvas"),
				ctx = canvas.getContext("2d");

			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;

			ctx.drawImage(this, 0, 0, canvas.width, canvas.height);

			init({
				context: ctx,
				width: canvas.width,
				height: canvas.height
			});
		}, false);
		img.src = "earth.png";
	};

	var init = function (earth) {
		var canvas = document.getElementById("gl"),
			gl = webgl_get_context(canvas, { antialias: true }),
			size;

		if (gl) {
			canvas.addEventListener("webglcontextlost", function(){
				console.log("context lost");
			}, false);

			size = canvas.parentNode.getBoundingClientRect();
			canvas.width = size.width;
			canvas.height = size.height;

			render(gl, size.width, size.height, earth);
		}
	};


	on_ready(pre_init);

})();


