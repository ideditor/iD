/**
 * 📽 Projection module for converting between Lon/Lat (λ,φ) and Cartesian (x,y) coordinates
 * @module
 */

import { Vec2 } from './vector';

/** An Object containing `x`, `y`, `k` numbers */
export interface Transform {
  x: number;
  y: number;
  k: number;
}


/** Class for converting between Lon/Lat (λ,φ) and Cartesian (x,y) coordinates */
export class Projection {
  private _k: number;
  private _x: number;
  private _y: number;
  private _dimensions: Vec2[] = [[0, 0], [0, 0]];


  /** Constructs a new Projection
   * @description Default corresponds to the world at zoom 1 and centered on "Null Island" [0, 0].
   * @param x x coordinate value
   * @param y y coordinate value
   * @param k zoom level
   * @example ```
   * const p1 = new Projection();
   * const p2 = new Projection(20, 30, 512 / Math.PI);
   * ```
   */
  constructor(x?: number, y?: number, k?: number) {
    this._x = x || 0;
    this._y = y || 0;
    this._k = k || 256 / Math.PI; // z1
  }


  /** Projects from given Lon/Lat (λ,φ) to Cartesian (x,y)
   * @param loc Lon/Lat (λ,φ)
   * @returns Cartesian (x,y)
   * @example ```
   * const p = new Projection();
   * p.project([0, 0]);                  // returns [0, 0]
   * p.project([180, -85.0511287798]);   // returns [256, 256]
   * p.project([-180, 85.0511287798]);   // returns [-256, -256]
   * ```
   */
  project(loc: Vec2): Vec2 {
    const lambda = (loc[0] * Math.PI) / 180;  // deg2rad
    const phi = (loc[1] * Math.PI) / 180;    // deg2rad
    const mercX = lambda;
    const mercY = Math.log(Math.tan(((Math.PI / 2) + phi) / 2));
    return [mercX * this._k + this._x, this._y - mercY * this._k];
  }


  /** Inverse projects from given Cartesian (x,y) to Lon/Lat (λ,φ)
   * @param point Cartesian (x,y)
   * @returns Lon/Lat (λ,φ)
   * @example ```
   * const p = new Projection();
   * p.invert([0, 0]);         // returns [0, 0]
   * p.invert([256, 256]);     // returns [180, -85.0511287798]
   * p.invert([-256, -256]);   // returns [-180, 85.0511287798]
   * ```
   */
  invert(point: Vec2): Vec2 {
    const mercX = (point[0] - this._x) / this._k;
    const mercY = (this._y - point[1]) / this._k;
    const lambda = mercX;
    const phi = 2 * Math.atan(Math.exp(mercY)) - (Math.PI / 2);
    return [(lambda * 180) / Math.PI, (phi * 180) / Math.PI]; // rad2deg
  }


  /** Sets/Gets the scale factor
   * @param val scale factor
   * @returns When argument is provided, sets the scale factor and returns `this` for method chaining.
   * Returns the scale factor otherwise
   * @example ```
   * const p = new Projection().scale(512 / Math.PI);   // sets scale
   * p.scale();   // gets scale - returns 512 / Math.PI;
   * ```
   */
  scale(val?: number): number | Projection {
    if (val === undefined) return this._k;
    this._k = +val;
    return this;
  }


  /** Sets/Gets the translation factor
   * @param val translation factor
   * @returns When argument is provided, sets the `x`,`y` translation values and returns `this` for method chaining.
   * Returns the `x`,`y` translation values otherwise
   * @example ```
   * const p = new Projection().translate([20, 30]);    // sets translation
   * p.translate();   // gets translation - returns [20, 30]
   * ```
   */
  translate(val?: Vec2): Vec2 | Projection {
    if (val === undefined) return [this._x, this._y];
    this._x = +val[0];
    this._y = +val[1];
    return this;
  }


  /** Sets/Gets the current viewport dimensions
   * @param val viewport dimensions
   * @returns When argument is provided, sets the viewport min/max dimensions and returns `this` for method chaining.
   * Returns the viewport min/max dimensions otherwise
   * @example ```
   * const p = new Projection().dimensions([[0, 0], [800, 600]]);    // sets viewport dimensions
   * p.dimensions();   // gets viewport dimensions - returns [[0, 0], [800, 600]]
   * ```
   */
  dimensions(val?: Vec2[]): Vec2[] | Projection {
    if (val === undefined) return this._dimensions;
    this._dimensions = val;
    return this;
  }


  /** Sets/Gets a transform object
   * @param val an object representing the current translation and scale
   * @returns When argument is provided, sets `x`,`y`,`k` from the Transform and returns `this` for method chaining.
   * Returns a Transform object containing the current `x`,`y`,`k` values otherwise
   * @example ```
   * const t = { x: 20, y: 30, k: 512 / Math.PI };
   * const p = new Projection().transform(t);    // sets `x`,`y`,`k` from given Transform object
   * p.transform();   // gets transform - returns { x: 20, y: 30, k: 512 / Math.PI }
   * ```
   */
  transform(obj?: Transform): Transform | Projection {
    if (obj === undefined) return { x: this._x, y: this._y, k: this._k };
    this._x = +obj.x;
    this._y = +obj.y;
    this._k = +obj.k;
    return this;
  }

}
