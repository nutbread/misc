class Path {
  constructor(points, offset, positionUsingOuter, steps) {
    if (points.length < 2) { throw new Error('Not enough points'); }
    if (typeof positionUsingOuter !== 'boolean') { positionUsingOuter = true; }
    if (typeof steps !== 'number') { steps = 10; }

    let ii = points.length;
    const windingOrder = Path.getWindingOrder(points);
    const pointInfos1 = [];

    // Compute segments
    for (let i = 0; i < ii; ++i) {
      const point1 = points[i];
      const point2 = points[(i + 1) % ii];
      const {position} = point1;
      const delta = point2.position.subtract(position);
      const length = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
      const tangent = new Vector2(delta.x / length, delta.y / length);
      const normal = new Vector2(tangent.y * windingOrder, -tangent.x * windingOrder);
      pointInfos1.push({
        position,
        tangent,
        normal,
        length,
        curveSize: 0,
      });
    }

    // Limit curveSize
    for (let i = 0; i < ii; ++i) {
      const point1 = points[i];
      const pointInfo = pointInfos1[i];
      const curveSize1 = point1.curveSize;
      let curveSize1New = curveSize1;
      if (curveSize1 > 0) {
        const i0 = (i + ii - 1) % ii;
        const point0 = points[i0];
        const point2 = points[(i + 1) % ii];
        const length01 = pointInfos1[i0].length;
        const length12 = pointInfo.length;
        const curveSize0 = Math.max(0, point0.curveSize);
        const curveSize2 = Math.max(0, point2.curveSize);
        if (curveSize1 + curveSize0 >= length01) {
          curveSize1New = Math.min(curveSize1New, length01 * curveSize1 / (curveSize1 + curveSize0));
        }
        if (curveSize1 + curveSize2 >= length12) {
          curveSize1New = Math.min(curveSize1New, length12 * curveSize1 / (curveSize1 + curveSize2));
        }
      }
      pointInfo.curveSize = curveSize1New;
    }

    // Generate points
    const createPointInfo2 = (position, tangent, normal, curveSize, corner) => ({
      position,
      tangent,
      normal,
      curve: curveSize > 0,
      corner,
      radius: 0,
      radiusCenter: position,
      angle1: 0,
      angle2: 0,
    });
    const pointInfos2 = [];
    for (let i = 0; i < ii; ++i) {
      const pointInfo1 = pointInfos1[i];
      const pointInfo2 = pointInfos1[(i + 1) % ii];
      const curveSize1 = pointInfo1.curveSize;
      const curveSize2 = pointInfo2.curveSize;
      const {tangent, normal, position} = pointInfo1;
      pointInfos2.push(createPointInfo2(position, tangent, normal, curveSize1, true));
      if (curveSize1 + curveSize2 > 0) {
        const {length} = pointInfo1;
        const position2 = pointInfo2.position;
        const t1 = curveSize1 / length;
        const t2 = 1 - curveSize2 / length;
        const tDiff = t2 - t1;
        const deltaZ = position2.z - position.z;
        if (t1 > 0) {
          const position1 = new Vector3(
            position.x + tangent.x * length * t1,
            position.y + tangent.y * length * t1,
            position.z + deltaZ * t1
          );
          pointInfos2.push(createPointInfo2(position1, tangent, normal, 0, false));
        }
        if (t2 < 1 && tDiff > 1.0e-5) {
          const position2 = new Vector3(
            position.x + tangent.x * length * t2,
            position.y + tangent.y * length * t2,
            position.z + deltaZ * t2
          );
          pointInfos2.push(createPointInfo2(position2, tangent, normal, 0, false));
        }
      }
    }

    // Create curve info
    ii = pointInfos2.length;
    for (let i = 0; i < ii; ++i) {
      const pointInfo1 = pointInfos2[i];
      if (!pointInfo1.corner) { continue; }
      const pointInfo0 = pointInfos2[(i + ii - 1) % ii];
      const pointInfo2 = pointInfos2[(i + 1) % ii];
      const position0 = pointInfo0.position;
      const position2 = pointInfo2.position;
      const normal0 = pointInfo0.normal;
      const normal2 = pointInfo2.normal;
      const angle1 = Math.atan2(normal0.y, normal0.x);
      let angle2 = Math.atan2(normal2.y, normal2.x);
      if ((angle2 < angle1) === (windingOrder > 0)) { angle2 += Math.PI * 2 * windingOrder; }
      pointInfo1.angle1 = angle1;
      pointInfo1.angle2 = angle2;
      if (!pointInfo1.curve) { continue; }
      const radiusCenter = Path.get2dLineIntersection(
        position0.x,
        position0.y,
        position0.x + normal0.x,
        position0.y + normal0.y,
        position2.x,
        position2.y,
        position2.x + normal2.x,
        position2.y + normal2.y
      );
      if (radiusCenter !== null) {
        const dx = position0.x - radiusCenter.x;
        const dy = position0.y - radiusCenter.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        pointInfo1.radius = radius;
        pointInfo1.radiusCenter = radiusCenter;
        pointInfo1.curve = true;
      } else {
        pointInfo1.curve = false;
      }
    }

    // Create segments
    this._segments = [];
    this._innerLength = 0;
    this._outerLength = 0;
    for (let i = 0; i < ii; ++i) {
      const pointInfo1 = pointInfos2[i];
      const pointInfo2 = pointInfos2[(i + 1) % ii];
      if (pointInfo1.curve) {
        // Arc
        const {radius, radiusCenter, angle1, angle2} = pointInfo1;
        const pointInfo0 = pointInfos2[(i + ii - 1) % ii];
        this._addArcSegment(radiusCenter, radius, offset, angle1, angle2, pointInfo0.position.z, pointInfo1.position.z, pointInfo2.position.z, steps);
      } else {
        if (pointInfo1.corner) {
          // Corner arc
          const {position, angle1, angle2} = pointInfo1;
          const {z} = position;
          this._addArcSegment(position, 0, offset, angle1, angle2, z, z, z, steps);
        }
        if (!pointInfo2.curve) {
          // Line
          const segment = new PathLineSegment(pointInfo1.position, pointInfo2.position, pointInfo1.normal, offset, steps);
          this._addSegment(segment);
        }
      }
    }

    // Assign normalization values
    ii = this._segments.length;
    const normalizedLengthDenominator = this.getLength(positionUsingOuter);
    let normalizedPosition = 0;
    for (let i = 0; i < ii; ++i) {
      const segment = this._segments[i];
      const normalizedLength = segment.getLength(positionUsingOuter) / normalizedLengthDenominator;
      segment.normalizedPosition = normalizedPosition;
      segment.normalizedLength = normalizedLength;
      normalizedPosition += normalizedLength;
    }
  }

  get segments() { return this._segments; }
  get innerLength() { return this._innerLength; }
  get outerLength() { return this._outerLength; }

  getLength(outer) {
    return outer ? this._outerLength : this._innerLength;
  }

  getClosestPositionTo(outer, target) {
    let distanceBest = null;
    let positionBest = null;
    for (const segment of this._segments) {
      const subPosition = segment.getClosestPositionTo(outer, target);
      const point = segment.getPointAt(outer, subPosition);
      const distance = Vector3.DistanceSquared(point, target);
      if (!(distanceBest === null || distance < distanceBest)) { continue; }
      distanceBest = distance;
      positionBest = segment.normalizedPosition + segment.normalizedLength * subPosition;
    }
    return positionBest;
  }

  getPointAt(outer, position) {
    const {segment, subPosition} = this._getSegmentAndSubPosition(position);
    return segment.getPointAt(outer, subPosition);
  }

  getTangentAt(outer, position) {
    const {segment, subPosition} = this._getSegmentAndSubPosition(position);
    return segment.getTangentAt(outer, subPosition);
  }

  getNormalAt(outer, position) {
    const {segment, subPosition} = this._getSegmentAndSubPosition(position);
    return segment.getNormalAt(outer, subPosition);
  }

  getBinormalAt(outer, position) {
    const {segment, subPosition} = this._getSegmentAndSubPosition(position);
    return segment.getBinormalAt(outer, subPosition);
  }

  static get2dLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denominator === 0) { return null; }
    const a = x1 * y2 - y1 * x2;
    const b = x3 * y4 - y3 * x4;
    const x = (a * (x3 - x4) - b * (x1 - x2)) / denominator;
    const y = (a * (y3 - y4) - b * (y1 - y2)) / denominator;
    return new Vector2(x, y);
  }

  static getWindingOrder(points) {
    let sum = 0;
    for (let i = 0, ii = points.length; i < ii; ++i) {
      const position1 = points[i].position;
      const position2 = points[(i + 1) % ii].position;
      sum += (position2.x - position1.x) * (position2.y + position1.y);
    }
    return sum < 0 ? 1 : -1;
  }

  static evaluateCubicHermiteSpline(p0, m0, p1, m1, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * p0 +
      (t3 - 2 * t2 + t) * m0 +
      (-2 * t3 + 3 * t2) * p1 +
      (t3 - t2) * m1
    );
  }

  static evaluateCubicHermiteSplineDerivative(p0, m0, p1, m1, t) {
    const t2 = t * t;
    const v1 = (6 * t2 - 6 * t);
    return (
      v1 * p0 +
      (3 * t2 - 4 * t + 1) * m0 -
      v1 * p1 +
      (3 * t2 - 2 * t) * m1
    );
  }

  static getCubicHermiteSplineLength(p0, m0, p1, m1, steps) {
    if (p0 === p1 && m0 === 0 && m1 === 0) { return 0; }
    let v1 = 0;
    let v2 = this.evaluateCubicHermiteSpline(p0, m0, p1, m1, 0);
    let length = 0;
    for (let i = 0; i < steps; ++i) {
      v1 = v2;
      v2 = this.evaluateCubicHermiteSpline(p0, m0, p1, m1, (i + 1) / steps);
      length += v2 - v1;
    }
    return length;
  }

  static repeatOffset(value, range, start) {
    return value - Math.floor((value - start) / range) * range;
  }

  _addSegment(segment) {
    this._segments.push(segment);
    this._innerLength += segment.getLength(false);
    this._outerLength += segment.getLength(true);
  }

  _addArcSegment(center, radius, offset, angle1, angle2, z1, z2, z3, steps) {
    if (Math.abs(z2 - (z1 + z3) * 0.5) < 1.0e-5) {
      this._addSegment(new PathArcSegment(center, radius, offset, angle1, angle2, z1, z3, steps));
    } else {
      const angleMid = (angle1 + angle2) * 0.5;
      this._addSegment(new PathArcSegment(center, radius, offset, angle1, angleMid, z1, z2, steps));
      this._addSegment(new PathArcSegment(center, radius, offset, angleMid, angle2, z2, z3, steps));
    }
  }

  _getSegmentAndSubPosition(position) {
    if (position <= 0) {
      return {segment: this._segments[0], subPosition: 0};
    }
    let iMax = this._segments.length;
    if (position >= 1) {
      return {segment: this._segments[iMax - 1], subPosition: 1};
    }
    let iMin = 0;
    while (iMax - iMin >= 2) {
      const iMid = Math.floor((iMax + iMin) / 2);
      const {normalizedPosition} = this._segments[iMid];
      if (position < normalizedPosition) {
        iMax = iMid;
      } else {
        iMin = iMid;
      }
    }
    const segment = this._segments[iMin];
    const subPosition = (position - segment.normalizedPosition) / segment.normalizedLength;
    return {segment, subPosition};
  }
}

class PathLineSegment {
  constructor(position1, position2, normal, offset, steps) {
    this._innerPosition1 = position1;
    this._innerPosition2 = position2;
    this._outerPosition1 = new Vector3(
      position1.x + normal.x * offset,
      position1.y + normal.y * offset,
      position1.z
    );
    this._outerPosition2 = new Vector3(
      position2.x + normal.x * offset,
      position2.y + normal.y * offset,
      position2.z
    );
    this._tangent = new Vector3(
      this._outerPosition2.x - this._outerPosition1.x,
      this._outerPosition2.y - this._outerPosition1.y,
      this._outerPosition2.z - this._outerPosition1.z
    );
    this._normal = new Vector3(normal.x, normal.y, 0);
    const dx = position2.x - position1.x;
    const dy = position2.y - position1.y;
    const lengthXY = Math.sqrt(dx * dx + dy * dy);
    const lengthZ = Path.getCubicHermiteSplineLength(position1.z, 0, position2.z, 0, steps);
    this._length = Math.sqrt(lengthXY * lengthXY + lengthZ * lengthZ);
    this._normalizedPosition = 0;
    this._normalizedLength = 0;
  }

  get type() { return 'line'; }
  get innerPosition1() { return this._innerPosition1; }
  get innerPosition2() { return this._innerPosition2; }
  get outerPosition1() { return this._outerPosition1; }
  get outerPosition2() { return this._outerPosition2; }
  get normal() { return this._normal; }
  get length() { return this._length; }
  get normalizedPosition() { return this._normalizedPosition; }
  set normalizedPosition(value) { this._normalizedPosition = value; }
  get normalizedLength() { return this._normalizedLength; }
  set normalizedLength(value) { this._normalizedLength = value; }

  getLength() {
    return this._length;
  }

  getClosestPositionTo(outer, target) {
    const {position1, position2} = this._getPositions(outer);
    const v1 = new Vector2(
      target.x - position1.x,
      target.y - position1.y
    );
    const v2 = new Vector2(
      position2.x - position1.x,
      position2.y - position1.y
    );
    const distance = Vector2.Dot(v1, v2) / v2.lengthSquared();
    return Math.max(0, Math.min(1, distance));
  }

  getPointAt(outer, position) {
    position = Math.max(0, Math.min(1, position));
    const {position1, position2} = this._getPositions(outer);
    return Vector3.Lerp(position1, position2, position);
  }

  getTangentAt(outer, position) {
    position = Math.max(0, Math.min(1, position));
    const {position1, position2} = this._getPositions(outer);
    const dx = position2.x - position1.x;
    const dy = position2.y - position1.y;
    const dz = Path.evaluateCubicHermiteSplineDerivative(position1.z, 0, position2.z, 0, position);
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return new Vector3(dx / length, dy / length, dz / length);
  }

  getNormalAt() {
    return this._normal.clone();
  }

  getBinormalAt() {
    return new Vector3(0, 0, 1);
  }

  _getPositions(outer) {
    return (
      outer ?
      {position1: this._outerPosition1, position2: this._outerPosition2} :
      {position1: this._innerPosition1, position2: this._innerPosition2}
    );
  }
}

class PathArcSegment {
  constructor(center, radius, offset, angle1, angle2, z1, z2, steps) {
    this._center = center;
    this._innerRadius = radius;
    this._outerRadius = radius + offset;
    this._angle1 = angle1;
    this._angle2 = angle2;
    this._z1 = z1;
    this._z2 = z2;
    const angleDelta = Math.abs(angle2 - angle1);
    let lengthXYInnerSq = angleDelta * this._innerRadius;
    let lengthXYOuterSq = angleDelta * this._outerRadius;
    let lengthZSq = Path.getCubicHermiteSplineLength(z1, 0, z2, 0, steps);
    lengthXYInnerSq *= lengthXYInnerSq;
    lengthXYOuterSq *= lengthXYOuterSq;
    lengthZSq *= lengthZSq;
    this._innerLength = Math.sqrt(lengthXYInnerSq + lengthZSq);
    this._outerLength = Math.sqrt(lengthXYOuterSq + lengthZSq);
    this._normalizedPosition = 0;
    this._normalizedLength = 0;
  }

  get type() { return 'arc'; }
  get center() { return this._center; }
  get innerRadius() { return this._innerRadius; }
  get outerRadius() { return this._outerRadius; }
  get angle1() { return this._angle1; }
  get angle2() { return this._angle2; }
  get z1() { return this._z1; }
  get z2() { return this._z2; }
  get innerLength() { return this._innerLength; }
  get outerLength() { return this._outerLength; }
  get normalizedPosition() { return this._normalizedPosition; }
  set normalizedPosition(value) { this._normalizedPosition = value; }
  get normalizedLength() { return this._normalizedLength; }
  set normalizedLength(value) { this._normalizedLength = value; }

  getLength(outer) {
    return outer ? this._outerLength : this._innerLength;
  }

  getClosestPositionTo(_outer, target) {
    const delta = new Vector2(target.x - this._center.x, target.y - this._center.y);
    const angleMin = Math.min(this._angle1, this._angle2);
    const angleMax = Math.max(this._angle1, this._angle2);
    const angleDelta = angleMax - angleMin;
    const angleMid = (angleMin + angleMax) * 0.5;
    let result = Math.atan2(delta.y, delta.x);
    result = Path.repeatOffset(result, Math.PI * 2, angleMid - Math.PI);
    result = (result < angleMin ? 0 : (result > angleMax ? 1 : (result - angleMin) / angleDelta));
    if (this._angle1 > this._angle2) {
      result = 1 - result;
    }
    return result;
  }

  getPointAt(outer, position) {
    position = Math.max(0, Math.min(1, position));
    const {x, y} = this._getNormalVector2(position);
    const radius = this._getRadius(outer);
    const z = Path.evaluateCubicHermiteSpline(this._z1, 0, this._z2, 0, position);
    return new Vector3(this._center.x + x * radius, this._center.y + y * radius, z);
  }

  getTangentAt(outer, position) {
    position = Math.max(0, Math.min(1, position));
    let {x, y} = this._getNormalVector2(position);
    const v1 = this.getLength(outer);
    if (v1 !== 0) {
      x *= v1;
      y *= v1;
    }
    const dz = Path.evaluateCubicHermiteSplineDerivative(this._z1, 0, this._z2, 0, position);
    const length = Math.sqrt(x * x + y * y + dz * dz);
    const v2 = (this._angle1 <= this._angle2 ? -1 : 1);
    return new Vector3(y / length * v2, -x / length * v2, dz / length);
  }

  getNormalAt(_outer, position) {
    position = Math.max(0, Math.min(1, position));
    const {x, y} = this._getNormalVector2(position);
    return new Vector3(x, y, 0);
  }

  getBinormalAt() {
    return new Vector3(0, 0, 1);
  }

  _getRadius(outer) {
    return outer ? this._outerRadius : this._innerRadius;
  }

  _getNormalVector2(position) {
    const angle = this._angle1 + (this._angle2 - this._angle1) * position;
    return new Vector2(Math.cos(angle), Math.sin(angle));
  }
}

class Vector2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  subtract(other) {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(value) {
    return new Vector2(this.x * value, this.y * value);
  }

  length() {
    return Math.sqrt(this.lengthSquared());
  }

  lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }

  static Dot(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
  }
}

class Vector3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  subtract(v) {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  static Lerp(a, b, t) {
    return new Vector3(
      (b.x - a.x) * t + a.x,
      (b.y - a.y) * t + a.y,
      (b.z - a.z) * t + a.z
    );
  }

  static DistanceSquared(v1, v2) {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return dx * dx + dy * dy + dz * dz;
  }
}

function setupSvgDemo(svg, path) {
  const createLine = (x1, y1, x2, y2, color, strokeWidth, strokeDasharray) => {
    const line = document.createElementNS(svgns, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    if (typeof strokeWidth !== 'undefined') { line.setAttribute('stroke-width', `${strokeWidth}`); }
    if (typeof strokeDasharray !== 'undefined') { line.setAttribute('stroke-dasharray', `${strokeDasharray}`); }
    return line;
  };

  const arcNormalSize = 10;
  const normalSize = 5;
  const tangentSize = 5;
  const svgns = svg.getAttribute('xmlns');

  // Info
  const innerLength = path.getLength(false);
  const outerLength = path.getLength(true)
  document.querySelector('#info').textContent = `innerLength=${innerLength}\nouterLength=${outerLength}`;

  // Path
  for (let i = 0; i < 2; ++i) {
    for (let j = 0, jj = path.segments.length; j < jj; ++j) {
      const segment = path.segments[j];
      const color = (j % 2) === 0 ? '#666' : '#999';
      const group = document.createElementNS(svgns, 'g');
      if (i > 0) {
        group.style.opacity = '0.5';
      }
      switch (segment.type) {
        case 'arc':
          {
            const {center, angle1, angle2} = segment;
            const radius = (i > 0 ? segment.outerRadius : segment.innerRadius);
            const normal1 = new Vector2(Math.cos(angle1), Math.sin(angle1));
            const normal2 = new Vector2(Math.cos(angle2), Math.sin(angle2));
            const position1 = new Vector3(center.x + normal1.x * radius, center.y + normal1.y * radius, segment.z1);
            const position2 = new Vector3(center.x + normal2.x * radius, center.y + normal2.y * radius, segment.z3);
            // Arc
            const arc = document.createElementNS(svgns, 'path');
            const angleDelta = angle2 - angle1;
            const largeArcFlag = Math.abs(angleDelta) >= Math.PI;
            const sweepFlag = angleDelta >= 0;
            arc.setAttribute('d', `M ${position1.x} ${position1.y} A ${radius} ${radius} 0 ${largeArcFlag ? 1 : 0} ${sweepFlag ? 1 : 0} ${position2.x} ${position2.y}`);
            arc.setAttribute('stroke', color);
            arc.setAttribute('fill', 'transparent');
            arc.setAttribute('stroke-width', '0.5');
            group.appendChild(arc);
            // Center
            const dot = document.createElementNS(svgns, 'circle');
            dot.setAttribute('cx', center.x);
            dot.setAttribute('cy', center.y);
            dot.setAttribute('r', 1);
            dot.setAttribute('fill', color);
            group.appendChild(dot);
            // Center lines
            group.appendChild(createLine(center.x, center.y, position1.x, position1.y, color, 0.5, 1));
            group.appendChild(createLine(center.x, center.y, position2.x, position2.y, color, 0.5, 1));
            // Normal lines
            group.appendChild(createLine(position1.x, position1.y, position1.x + normal1.x * arcNormalSize, position1.y + normal1.y * arcNormalSize, color, 0.5, 0.5));
            group.appendChild(createLine(position2.x, position2.y, position2.x + normal2.x * arcNormalSize, position2.y + normal2.y * arcNormalSize, color, 0.5, 0.5));
          }
          break;
        case 'line':
          {
            // Line
            const position1 = (i > 0 ? segment.outerPosition1 : segment.innerPosition1);
            const position2 = (i > 0 ? segment.outerPosition2 : segment.innerPosition2);
            group.appendChild(createLine(position1.x, position1.y, position2.x, position2.y, color, 0.5));
          }
          break;
      }
      svg.appendChild(group);
    }
  }

  // Dots
  for (let i = 0; i < 2; ++i) {
    const outer = (i > 0);
    const color = '#fff';
    for (let position = 0; position < 1; position += 0.025) {
      const group = document.createElementNS(svgns, 'g');
      svg.appendChild(group);
      if (i > 0) {
        group.style.opacity = '0.5';
      }
      const point = path.getPointAt(outer, position);
      const tangent = path.getTangentAt(outer, position);
      const normal = path.getNormalAt(outer, position);
      path.getBinormalAt(outer, position);
      group.appendChild(createLine(point.x, point.y, point.x + tangent.x * tangentSize, point.y + tangent.y * tangentSize, '#a00', 1));
      group.appendChild(createLine(point.x, point.y, point.x + normal.x * normalSize, point.y + normal.y * normalSize, '#0a0', 1));
      const dot = document.createElementNS(svgns, 'circle');
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
      dot.setAttribute('r', 1);
      dot.setAttribute('fill', color);
      group.appendChild(dot);
    }
  }

  // Mouse
  const mouseDots = [];
  for (let i = 0; i < 2; ++i) {
    const color = '#fff';
    const dot = document.createElementNS(svgns, 'circle');
    dot.setAttribute('cx', 0);
    dot.setAttribute('cy', 0);
    dot.setAttribute('r', 5);
    dot.setAttribute('stroke', color);
    dot.setAttribute('stroke-width', '0.5');
    dot.setAttribute('fill', 'transparent');
    svg.appendChild(dot);
    mouseDots.push(dot);
  }

  window.addEventListener('mousemove', (e) => {
    const box = svg.getBoundingClientRect();
    const target = new Vector3(e.clientX - box.left, e.clientY - box.top, 0);
    for (let i = 0; i < 2; ++i) {
      const dot = mouseDots[i];
      const outer = (i > 0);
      const position = path.getClosestPositionTo(outer, target);
      const point = path.getPointAt(outer, position);
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
    }
  });

  // Animation
  const animationDots = [];
  for (let i = 0; i < 2; ++i) {
    const color = '#fff8';
    const dot = document.createElementNS(svgns, 'circle');
    dot.setAttribute('cx', 0);
    dot.setAttribute('cy', 0);
    dot.setAttribute('r', 3);
    dot.setAttribute('stroke', color);
    dot.setAttribute('stroke-width', '0.5');
    dot.setAttribute('fill', 'transparent');
    svg.appendChild(dot);
    animationDots.push(dot);
  }

  let animationPosition = 0;
  let t1 = performance.now();
  const animationCallback = () => {
    let t2 = performance.now();
    const deltaTime = (t2 - t1) / 1000;
    t1 = t2;
    animationPosition = (animationPosition + 0.1 * deltaTime) % 1;
    for (let i = 0; i < 2; ++i) {
      const dot = animationDots[i];
      const outer = (i > 0);
      const point = path.getPointAt(outer, animationPosition);
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
    }
    requestAnimationFrame(animationCallback);
  };
  requestAnimationFrame(animationCallback);
  animationCallback();
}

window.addEventListener('load', () => {
  const points = [
    {
      position: new Vector3(100, 100, 0),
      distance: 10,
      curveSize: 100,
    },
    {
      position: new Vector3(200, 100, 0),
      distance: 10,
      curveSize: 50,
    },
    {
      position: new Vector3(300, 200, 0),
      distance: 10,
      curveSize: 20,
    },
    {
      position: new Vector3(100, 200, 0),
      distance: 10,
      curveSize: 0,
    },
  ];
  if (location.hash === '#reverse') {
    points.reverse();
  }
  const path = new Path(points, 40, true, 10);
  const svg = document.querySelector('svg');
  setupSvgDemo(svg, path);
  console.log(path);
});
