/**
 * 📺 Viewport module for managing view state and converting between Lon/Lat (λ,φ) and Cartesian (x,y) coordinates
 * @module
 */

import { TAU, DEG2RAD, RAD2DEG, HALF_PI, MIN_K, MAX_K, MIN_PHI, MAX_PHI } from './constants';
import { Extent } from './Extent';
import { numClamp, numWrap } from './number';
import { geoZoomToScale } from './geo';
import { geomRotatePoints } from './geom';
import { Vec2, vecRotate, vecScale, vecSubtract, vecCeil } from './vector';


/** The parameters that define the viewport */
export interface Transform {
  x: number;
  y: number;
  k: number;
  r: number;
}


/** `Viewport` is a class for managing the state of the viewer
 *   and converting between Lon/Lat (λ,φ) and Cartesian (x,y) coordinates
 *
 *  Original geographic coordinate data is in WGS84 (Lon,Lat)
 *  and "projected" into screen space (x,y) using the Web Mercator projection
 *  see: https://en.wikipedia.org/wiki/Web_Mercator_projection
 *
 *  The parameters of this projection are stored in `_transform`
 *   `x`,`y` - translation, (from top-left Mercator coordinate 0,0, to top-left screen coordinate)
 *   `k`     - scale, (related to the map zoom, how many Mercator coordinates the world contains)
 *   `r`     - rotation, optionally applied post-projection to change the map bearing away from north-up
 *
 *  The viewport (what a user can see) is defined by:
 *  A rectangular Extent A-B-C-D (stored in `_dimensions`), representing the user's screen.
 *  By default, the origin of the screen space is top-left coordinate 'A' [0,0].
 *  When a rotation is applied, the visible extent extends to E-F-G-H and top-left coordinate 'E'.
 *
 *        |  E__
 *        |r/   ''--..__
 *        |/           r''--..__
 *  [0,0] A=======================D__
 *       /‖                       ‖  ''H         N
 *      /r‖                       ‖   /      W._/
 *     /  ‖           +           ‖  /         /'-E
 *    /   ‖                       ‖r/         S
 *   D__  ‖                       ‖/
 *      ''B=======================C [w,h]
 *           ''--..__r           /|
 *                   ''--,,__   /r|
 *                           ''G  |
 */
export class Viewport {
  private _transform: Transform;
  private _dimensions: Vec2;


  /** Constructs a new Viewport
   * @description Default viewport corresponds to the world at zoom 1 and centered on "Null Island" [0, 0].
   * @param transform
   * @param dimensions
   * @example ```
   * const view1 = new Viewport();
   * const view2 = new Viewport({x: 20, y: 30, k: 512 / Math.PI });
   * ```
   */
  constructor(transform?: any, dimensions?: Vec2) {
    this._transform = {
      x: transform?.x || 0,
      y: transform?.y || 0,
      k: numClamp(transform?.k || 256 / Math.PI, MIN_K, MAX_K),   // constrain to z0..z24, default z1
      r: numWrap(transform?.r || 0, 0, TAU)                       // constrain to 0..2π
    };

    this._dimensions = dimensions || [0, 0];
  }


  /** Projects a coordinate from Lon/Lat (λ,φ) to Cartesian (x,y)
   * @param loc Lon/Lat (λ,φ)
   * @returns Cartesian (x,y)
   * @example ```
   * const view = new Viewport();
   * view.project([0, 0]);                  // returns [0, 0]
   * view.project([180, -85.0511287798]);   // returns [256, 256]
   * view.project([-180, 85.0511287798]);   // returns [-256, -256]
   * ```
   */
  project(loc: Vec2, includeRotation?: boolean): Vec2 {
    const { x, y, k, r } = this._transform;

    const lambda = loc[0] * DEG2RAD;
    const phi = numClamp(loc[1] * DEG2RAD, MIN_PHI, MAX_PHI);
    const mercatorX = lambda
    const mercatorY = Math.log(Math.tan((HALF_PI + phi) / 2));
    const point: Vec2 = [mercatorX * k + x, y - mercatorY * k];

    if (includeRotation && r) {
      const center = vecScale(this._dimensions, 0.5);
      return vecRotate(point, r, center);
    } else {
      return point;
    }
  }


  /** Unprojects a coordinate from given Cartesian (x,y) to Lon/Lat (λ,φ)
   * @param point Cartesian (x,y)
   * @returns Lon/Lat (λ,φ)
   * @example ```
   * const view = new Viewport();
   * view.unproject([0, 0]);         // returns [0, 0]
   * view.unproject([256, 256]);     // returns [180, -85.0511287798]
   * view.unproject([-256, -256]);   // returns [-180, 85.0511287798]
   * ```
   */
  unproject(point: Vec2, includeRotation?: boolean): Vec2 {
    const { x, y, k, r } = this._transform;

    if (includeRotation && r) {
      const center = vecScale(this._dimensions, 0.5);
      point = vecRotate(point, -r, center);
    }

    const mercatorX = (point[0] - x) / k;
    const mercatorY = numClamp((y - point[1]) / k, -Math.PI, Math.PI);
    const lambda = mercatorX;
    const phi = 2 * Math.atan(Math.exp(mercatorY)) - HALF_PI;

    return [lambda * RAD2DEG, phi * RAD2DEG];
  }


  /** Sets/Gets the translation factor
   * @param val translation factor
   * @returns When argument is provided, sets the `x`,`y` translation values and returns `this` for method chaining.
   * Returns the `x`,`y` translation values otherwise
   * @example ```
   * const view = new Viewport().translate([20, 30]);    // sets translation
   * view.translate();   // gets translation - returns [20, 30]
   * ```
   */
  translate(val?: Vec2): Vec2 | Viewport {
    if (val === undefined) return [this._transform.x, this._transform.y];
    this._transform.x = +val[0];
    this._transform.y = +val[1];
    return this;
  }


  /** Sets/Gets the scale factor
   * @param val scale factor
   * @returns When argument is provided, sets the scale factor and returns `this` for method chaining.
   * Returns the scale factor otherwise
   * @example ```
   * const view = new Viewport().scale(512 / Math.PI);   // sets scale
   * view.scale();   // gets scale - returns 512 / Math.PI;
   * ```
   */
  scale(val?: number): number | Viewport {
    if (val === undefined) return this._transform.k;
    this._transform.k = numClamp(+val, MIN_K, MAX_K);   // constrain to z0..z24
    return this;
  }


  /** Sets/Gets the rotation factor
   * 0 is no rotation, which results in a map with North facing up.
   * @param val rotation factor in radians (clockwise)
   * @returns When argument is provided, sets the rotation factor and returns `this` for method chaining.
   * Returns the rotation factor otherwise
   * @example ```
   * const view = new Viewport().rotate(Math.PI / 2);   // sets rotation
   * view.rotate();   // gets rotation - returns Math.PI / 2;
   * ```
   */
  rotate(val?: number): number | Viewport {
    if (val === undefined) return this._transform.r;
    this._transform.r = numWrap(+val, 0, TAU);   // constrain to 0..2π
    return this;
  }


  /** Sets/Gets a transform object
   * @param val an object representing the current translation and scale
   * @returns When argument is provided, sets `x`,`y`,`k`,`r` from the Transform and returns `this` for method chaining.
   * Returns a Transform object containing the current `x`,`y`,`k`,`r` values otherwise
   * @example ```
   * const t = { x: 20, y: 30, k: 512 / Math.PI, r: Math.PI / 2 };
   * const view = new Viewport().transform(t);    // sets `x`,`y`,`k` from given Transform object
   * view.transform();   // gets transform - returns { x: 20, y: 30, k: 512 / Math.PI, r: Math.PI / 2 }
   * ```
   */
  transform(obj?: any): Transform | Viewport {
    if (obj === undefined) return Object.assign({}, this._transform);  // copy

    if (obj.x !== undefined)  this._transform.x = +obj.x;
    if (obj.y !== undefined)  this._transform.y = +obj.y;
    if (obj.k !== undefined)  this._transform.k = numClamp(+obj.k, MIN_K, MAX_K);  // constrain to z0..z24
    if (obj.r !== undefined)  this._transform.r = numWrap(+obj.r, 0, TAU);         // constrain to 0..2π

    return this;
  }


  /** Sets/Gets the screen dimensions
   * @param val viewport dimensions
   * @returns When argument is provided, sets the viewport max dimensions and returns `this` for method chaining.
   * Returns the viewport max dimensions otherwise
   * @example ```
   * const view = new Viewport().dimensions([800, 600]);  // sets viewport dimensions
   * view.dimensions();   // returns [800, 600]
   * ```
   */
  dimensions(val?: Vec2): Vec2 | Viewport {
    if (val === undefined) return this._dimensions;
    this._dimensions = vecCeil([+val[0], +val[1]]);
    return this;
  }


  /** Returns the screen center coordinate
   * @returns viewport screen center coordinate
   * @example ```
   * const view = new Viewport().dimensions([800, 600]);
   * view.center();   // returns [400, 300]
   * ```
   */
  center(): Vec2 {
    return vecScale(this._dimensions, 0.5);
  }


  /** Returns the viewport's visible polygon in screen coords wound counterclockwise.
   *  We construct a rotated rectangle that contains the original screen rectangle.
   *  The rotated rectangle has the same center point as the original screen rectangle.
   *  see https://math.stackexchange.com/questions/1628657/dimensions-of-a-rectangle-containing-a-rotated-rectangle
   *
   *        |  E__
   *        |r/   ''--..__
   *        |/           r''--..__
   *  [0,0] A=======================D__
   *       /‖                       ‖  ''H         N
   *      /r‖                       ‖   /      W._/
   *     /  ‖           +           ‖  /         /'-E
   *    /   ‖                       ‖r/         S
   *   D__  ‖                       ‖/
   *      ''B=======================C [w,h]
   *           ''--..__r           /|
   *                   ''--,,__   /r|
   *                           ''G  |
   */
  visiblePolygon(): Vec2[] {
    const [w, h] = this._dimensions;
    const r = this._transform.r;

    if (r) {
      const sinr = Math.abs(Math.sin(r));
      const cosr = Math.abs(Math.cos(r));

      const ae = w * sinr;
      const af = h * cosr;

      const ex = ae * sinr;
      const ey = ae * cosr;
      const fx = af * sinr;
      const fy = af * cosr;

      const E: Vec2 = [ex, -ey];
      const F: Vec2 = [-fx, fy];
      const G: Vec2 = [w - ex, h + ey];
      const H: Vec2 = [w + fx, h - fy];

      return [E, F, G, H, E];
    } else {
      return [[0, 0], [0, h], [w, h], [0, w], [0, 0]];
    }
  }


  visibleDimensions(): Vec2 {
    const [w, h] = this._dimensions;
    const r = this._transform.r;

    if (r) {
      const sinr = Math.abs(Math.sin(r));
      const cosr = Math.abs(Math.cos(r));

      const w2 = w * cosr + h * sinr;    // ed + fb
      const h2 = h * cosr + w * sinr;    // af + ae

      return vecCeil([w2, h2]);
    } else {
      return [w, h];
    }
  }


  /** Gets the visible center coordinate
   */
  visibleCenter(): Vec2 {
    return vecScale(this.visibleDimensions(), 0.5);
  }


  extent(): Extent {
    const polygon = this.visiblePolygon();
    const extent = new Extent();

    for (let i = 0; i < polygon.length - 1; i++) {  // skip last point, it's first point repeated
      extent.extendSelf(this.unproject(polygon[i], true));
    }
    return extent;
  }

}
