/**
 * Reality Mode: Show actual aircraft with livery colors and flight information
 */
class RealityVisualization extends AircraftVisualization {
  constructor(canvas, ctx) {
    super(canvas, ctx);

    // Reality tracks raw positions: no easing, trail point on any movement
    this.ease = 1;
    this.trailThreshold = 0;

    Object.assign(this.options, {
      showTrails: true,
      showCallsigns: true,
      showAltitude: true,
      showSpeed: true,
      showRoute: true,
      aircraftIcon: 'chevron',
      labelFormat: '{airline} {type} to {destination}',
      accentColor: '#4CAF50'
    });
  }
}
