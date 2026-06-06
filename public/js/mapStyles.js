/**
 * Google Maps Snazzy Map Styles
 * 7 curated styles for theARTofFLIGHT map mode
 */
const MAP_STYLES = {
  assassins_creed: {
    name: "Assassin's Creed IV",
    label: "Assassin's Creed IV",
    styles: [
      {"featureType":"all","elementType":"all","stylers":[{"visibility":"on"}]},
      {"featureType":"all","elementType":"labels","stylers":[{"visibility":"off"},{"saturation":"-100"}]},
      {"featureType":"all","elementType":"labels.text.fill","stylers":[{"saturation":36},{"color":"#000000"},{"lightness":40},{"visibility":"off"}]},
      {"featureType":"all","elementType":"labels.text.stroke","stylers":[{"visibility":"off"},{"color":"#000000"},{"lightness":16}]},
      {"featureType":"all","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
      {"featureType":"administrative","elementType":"geometry.fill","stylers":[{"color":"#000000"},{"lightness":20}]},
      {"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#000000"},{"lightness":17},{"weight":1.2}]},
      {"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":20}]},
      {"featureType":"landscape","elementType":"geometry.fill","stylers":[{"color":"#4d6059"}]},
      {"featureType":"landscape","elementType":"geometry.stroke","stylers":[{"color":"#4d6059"}]},
      {"featureType":"landscape.natural","elementType":"geometry.fill","stylers":[{"color":"#4d6059"}]},
      {"featureType":"poi","elementType":"geometry","stylers":[{"lightness":21}]},
      {"featureType":"poi","elementType":"geometry.fill","stylers":[{"color":"#4d6059"}]},
      {"featureType":"poi","elementType":"geometry.stroke","stylers":[{"color":"#4d6059"}]},
      {"featureType":"road","elementType":"geometry","stylers":[{"visibility":"on"},{"color":"#7f8d89"}]},
      {"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#7f8d89"}]},
      {"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#7f8d89"},{"lightness":17}]},
      {"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#7f8d89"},{"lightness":29},{"weight":0.2}]},
      {"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":18}]},
      {"featureType":"road.arterial","elementType":"geometry.fill","stylers":[{"color":"#7f8d89"}]},
      {"featureType":"road.arterial","elementType":"geometry.stroke","stylers":[{"color":"#7f8d89"}]},
      {"featureType":"road.local","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":16}]},
      {"featureType":"road.local","elementType":"geometry.fill","stylers":[{"color":"#7f8d89"}]},
      {"featureType":"road.local","elementType":"geometry.stroke","stylers":[{"color":"#7f8d89"}]},
      {"featureType":"transit","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":19}]},
      {"featureType":"water","elementType":"all","stylers":[{"color":"#2b3638"},{"visibility":"on"}]},
      {"featureType":"water","elementType":"geometry","stylers":[{"color":"#2b3638"},{"lightness":17}]},
      {"featureType":"water","elementType":"geometry.fill","stylers":[{"color":"#24282b"}]},
      {"featureType":"water","elementType":"geometry.stroke","stylers":[{"color":"#24282b"}]},
      {"featureType":"water","elementType":"labels","stylers":[{"visibility":"off"}]},
      {"featureType":"water","elementType":"labels.text","stylers":[{"visibility":"off"}]},
      {"featureType":"water","elementType":"labels.text.fill","stylers":[{"visibility":"off"}]},
      {"featureType":"water","elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},
      {"featureType":"water","elementType":"labels.icon","stylers":[{"visibility":"off"}]}
    ]
  },

  carmela: {
    name: 'Carmela',
    label: 'Carmela',
    styles: [
      {"featureType":"water","elementType":"geometry","stylers":[{"color":"#004358"}]},
      {"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#1f8a70"}]},
      {"featureType":"poi","elementType":"geometry","stylers":[{"color":"#1f8a70"}]},
      {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#fd7400"}]},
      {"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#1f8a70"},{"lightness":-20}]},
      {"featureType":"road.local","elementType":"geometry","stylers":[{"color":"#1f8a70"},{"lightness":-17}]},
      {"elementType":"labels.text.stroke","stylers":[{"color":"#ffffff"},{"visibility":"on"},{"weight":0.9}]},
      {"elementType":"labels.text.fill","stylers":[{"visibility":"on"},{"color":"#ffffff"}]},
      {"featureType":"poi","elementType":"labels","stylers":[{"visibility":"simplified"}]},
      {"elementType":"labels.icon","stylers":[{"visibility":"off"}]},
      {"featureType":"transit","elementType":"geometry","stylers":[{"color":"#1f8a70"},{"lightness":-10}]},
      {},
      {"featureType":"administrative","elementType":"geometry","stylers":[{"color":"#1f8a70"},{"weight":0.7}]}
    ]
  },

  '23_sul': {
    name: '23 SUL',
    label: '23 SUL',
    styles: [
      {"featureType":"administrative","elementType":"all","stylers":[{"hue":"#000000"},{"lightness":-100},{"visibility":"off"}]},
      {"featureType":"administrative.locality","elementType":"all","stylers":[{"visibility":"on"},{"saturation":"-3"},{"gamma":"1.81"},{"weight":"0.01"},{"hue":"#ff0000"},{"lightness":"17"}]},
      {"featureType":"administrative.land_parcel","elementType":"all","stylers":[{"visibility":"off"}]},
      {"featureType":"landscape","elementType":"geometry","stylers":[{"hue":"#dddddd"},{"saturation":-100},{"lightness":-3},{"visibility":"on"}]},
      {"featureType":"landscape","elementType":"labels","stylers":[{"hue":"#000000"},{"saturation":-100},{"lightness":-100},{"visibility":"off"}]},
      {"featureType":"poi","elementType":"all","stylers":[{"hue":"#000000"},{"saturation":-100},{"lightness":-100},{"visibility":"off"}]},
      {"featureType":"road","elementType":"geometry","stylers":[{"hue":"#bbbbbb"},{"saturation":-100},{"lightness":26},{"visibility":"on"}]},
      {"featureType":"road","elementType":"labels","stylers":[{"hue":"#ffffff"},{"saturation":-100},{"lightness":100},{"visibility":"off"}]},
      {"featureType":"road.arterial","elementType":"labels.text","stylers":[{"visibility":"on"},{"color":"#797979"}]},
      {"featureType":"road.arterial","elementType":"labels.text.fill","stylers":[{"color":"#868686"}]},
      {"featureType":"road.arterial","elementType":"labels.text.stroke","stylers":[{"color":"#ffffff"}]},
      {"featureType":"road.local","elementType":"all","stylers":[{"hue":"#ff0000"},{"saturation":-100},{"lightness":100},{"visibility":"on"}]},
      {"featureType":"road.local","elementType":"labels.text","stylers":[{"visibility":"on"}]},
      {"featureType":"road.local","elementType":"labels.text.fill","stylers":[{"color":"#b6b2b2"}]},
      {"featureType":"transit","elementType":"labels","stylers":[{"hue":"#ff0000"},{"lightness":-100},{"visibility":"off"}]},
      {"featureType":"water","elementType":"geometry","stylers":[{"hue":"#ff0000"},{"saturation":-100},{"lightness":100},{"visibility":"on"}]},
      {"featureType":"water","elementType":"labels","stylers":[{"hue":"#000000"},{"saturation":-100},{"lightness":-100},{"visibility":"off"}]}
    ]
  },

  arch: {
    name: 'Arch',
    label: 'Arch',
    styles: [
      {"featureType":"administrative","elementType":"geometry","stylers":[{"color":"#a7a7a7"}]},
      {"featureType":"administrative","elementType":"labels.text.fill","stylers":[{"visibility":"on"},{"color":"#737373"}]},
      {"featureType":"administrative.country","elementType":"labels.text","stylers":[{"visibility":"off"}]},
      {"featureType":"administrative.province","elementType":"labels.text","stylers":[{"visibility":"off"}]},
      {"featureType":"administrative.locality","elementType":"labels.text","stylers":[{"visibility":"off"}]},
      {"featureType":"administrative.neighborhood","elementType":"labels.text","stylers":[{"visibility":"off"}]},
      {"featureType":"administrative.land_parcel","elementType":"labels.text","stylers":[{"visibility":"off"}]},
      {"featureType":"landscape","elementType":"geometry.fill","stylers":[{"visibility":"on"},{"color":"#ffffff"}]},
      {"featureType":"landscape","elementType":"labels.text","stylers":[{"visibility":"off"}]},
      {"featureType":"landscape.man_made","elementType":"geometry.stroke","stylers":[{"color":"#767676"}]},
      {"featureType":"landscape.natural.landcover","elementType":"geometry","stylers":[{"visibility":"on"}]},
      {"featureType":"poi","elementType":"geometry.fill","stylers":[{"visibility":"on"},{"color":"#dadada"}]},
      {"featureType":"poi","elementType":"labels","stylers":[{"visibility":"off"}]},
      {"featureType":"poi","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
      {"featureType":"poi.park","elementType":"geometry.fill","stylers":[{"color":"#8c8c8c"},{"visibility":"on"}]},
      {"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},
      {"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#696969"}]},
      {"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
      {"featureType":"road.highway","elementType":"geometry","stylers":[{"visibility":"off"}]},
      {"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#ffffff"}]},
      {"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"visibility":"off"},{"color":"#b3b3b3"}]},
      {"featureType":"road.highway","elementType":"labels","stylers":[{"visibility":"off"}]},
      {"featureType":"road.arterial","elementType":"geometry.fill","stylers":[{"color":"#ffffff"}]},
      {"featureType":"road.arterial","elementType":"geometry.stroke","stylers":[{"color":"#d6d6d6"}]},
      {"featureType":"road.local","elementType":"geometry.fill","stylers":[{"visibility":"on"},{"color":"#ffffff"},{"weight":1.8}]},
      {"featureType":"road.local","elementType":"geometry.stroke","stylers":[{"color":"#d7d7d7"}]},
      {"featureType":"transit","elementType":"all","stylers":[{"color":"#808080"},{"visibility":"off"}]},
      {"featureType":"water","elementType":"geometry.fill","stylers":[{"color":"#d3d3d3"}]},
      {"featureType":"water","elementType":"labels.text","stylers":[{"visibility":"off"}]}
    ]
  },

  vibrant_village: {
    name: 'Vibrant Village',
    label: 'Vibrant Village',
    styles: [
      {"featureType":"landscape.natural","stylers":[{"visibility":"on"},{"color":"#ecd5c3"}]},
      {"featureType":"water","stylers":[{"visibility":"on"},{"color":"#32c4fe"}]},
      {"featureType":"landscape.natural","stylers":[{"visibility":"simplified"}]},
      {"featureType":"transit","stylers":[{"visibility":"off"}]},
      {"featureType":"poi","stylers":[{"visibility":"off"}]},
      {"featureType":"road.arterial","elementType":"geometry.fill","stylers":[{"visibility":"on"},{"color":"#ffffff"}]},
      {"featureType":"road.arterial","elementType":"geometry.stroke","stylers":[{"visibility":"off"}]},
      {"featureType":"road.local","elementType":"geometry.stroke","stylers":[{"visibility":"off"}]},
      {"featureType":"landscape.man_made","stylers":[{"visibility":"off"}]},
      {"featureType":"road.highway.controlled_access","elementType":"geometry.fill","stylers":[{"color":"#baaca2"}]},
      {"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"visibility":"off"}]},
      {"featureType":"road.highway.controlled_access","elementType":"labels.text.fill","stylers":[{"visibility":"on"},{"color":"#ffffff"}]},
      {"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#565757"},{"visibility":"on"}]},
      {"featureType":"road.local","elementType":"labels.text.stroke","stylers":[{"color":"#808080"},{"visibility":"off"}]},
      {"featureType":"road.arterial","elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},
      {"featureType":"administrative.neighborhood","stylers":[{"visibility":"off"}]},
      {"featureType":"administrative.locality","elementType":"labels.text.fill","stylers":[{"visibility":"on"},{"color":"#535555"}]},
      {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#fffffe"}]},
      {"featureType":"road.highway","elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},
      {"featureType":"road.highway","elementType":"labels.icon","stylers":[{"visibility":"on"}]},
      {"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"on"},{"saturation":-100},{"lightness":17}]}
    ]
  },

  wy: {
    name: 'WY',
    label: 'WY',
    styles: [
      {"featureType":"all","elementType":"geometry.fill","stylers":[{"weight":"2.00"}]},
      {"featureType":"all","elementType":"geometry.stroke","stylers":[{"color":"#9c9c9c"}]},
      {"featureType":"all","elementType":"labels.text","stylers":[{"visibility":"on"}]},
      {"featureType":"landscape","elementType":"all","stylers":[{"color":"#f2f2f2"}]},
      {"featureType":"landscape","elementType":"geometry.fill","stylers":[{"color":"#ffffff"}]},
      {"featureType":"landscape.man_made","elementType":"geometry.fill","stylers":[{"color":"#ffffff"}]},
      {"featureType":"poi","elementType":"all","stylers":[{"visibility":"off"}]},
      {"featureType":"road","elementType":"all","stylers":[{"saturation":-100},{"lightness":45}]},
      {"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#eeeeee"}]},
      {"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#7b7b7b"}]},
      {"featureType":"road","elementType":"labels.text.stroke","stylers":[{"color":"#ffffff"}]},
      {"featureType":"road.highway","elementType":"all","stylers":[{"visibility":"simplified"}]},
      {"featureType":"road.arterial","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
      {"featureType":"transit","elementType":"all","stylers":[{"visibility":"off"}]},
      {"featureType":"water","elementType":"all","stylers":[{"color":"#46bcec"},{"visibility":"on"}]},
      {"featureType":"water","elementType":"geometry.fill","stylers":[{"color":"#c8d7d4"}]},
      {"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#070707"}]},
      {"featureType":"water","elementType":"labels.text.stroke","stylers":[{"color":"#ffffff"}]}
    ]
  },

  subtle_greyscale: {
    name: 'Subtle Greyscale',
    label: 'Subtle Greyscale',
    styles: [
      {"featureType":"administrative","elementType":"all","stylers":[{"saturation":"-100"}]},
      {"featureType":"administrative.province","elementType":"all","stylers":[{"visibility":"off"}]},
      {"featureType":"landscape","elementType":"all","stylers":[{"saturation":-100},{"lightness":65},{"visibility":"on"}]},
      {"featureType":"poi","elementType":"all","stylers":[{"saturation":-100},{"lightness":"50"},{"visibility":"simplified"}]},
      {"featureType":"road","elementType":"all","stylers":[{"saturation":"-100"}]},
      {"featureType":"road.highway","elementType":"all","stylers":[{"visibility":"simplified"}]},
      {"featureType":"road.arterial","elementType":"all","stylers":[{"lightness":"30"}]},
      {"featureType":"road.local","elementType":"all","stylers":[{"lightness":"40"}]},
      {"featureType":"transit","elementType":"all","stylers":[{"saturation":-100},{"visibility":"simplified"}]},
      {"featureType":"water","elementType":"geometry","stylers":[{"hue":"#ffff00"},{"lightness":-25},{"saturation":-97}]},
      {"featureType":"water","elementType":"labels","stylers":[{"lightness":-25},{"saturation":-100}]}
    ]
  },

  custom: {
    name: 'Custom',
    label: 'Custom JSON',
    styles: [] // Dynamically set from settings
  }
};

/**
 * Set a custom map style from parsed JSON
 */
function setCustomMapStyle(stylesArray) {
  if (Array.isArray(stylesArray)) {
    MAP_STYLES.custom.styles = stylesArray;
  }
}
