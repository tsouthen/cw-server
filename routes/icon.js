var express = require('express');
var router = express.Router();
var path = require('path');

getImageName = function(iconCode) {
  var imageName = 'sun';

  switch (iconCode) {
    case 0: //sun
        imageName = 'sun';
        break;

    case 1: //little clouds
        imageName = 'sun_cloud';
        break;

    case 4: //increasing cloud
        imageName = 'sun_cloud_increasing';
        break;

    case 5: //decreasing cloud
    case 20: //decreasing cloud
        imageName = 'sun_cloud_decreasing';
        break;

    case 2: //big cloud with sun
    case 3: //sun behind big cloud
    case 22: //big cloud with sun
        imageName = 'cloud_sun';
        break;

    case 6: //rain with sun behind cloud
        imageName = 'cloud_drizzle_sun_alt';
        break;

    case 7: //rain and snow with sun behind cloud
    case 8: //snow with sun behind cloud
        imageName = 'cloud_snow_sun_alt';
        break;

    case 9: //cloud rain lightning
        imageName = 'cloud_lightning_sun';
        break;

    case 10: //cloud
        imageName = 'cloud';
        break;

    case 11:
    case 28:
        imageName = 'cloud_drizzle_alt';
        break;

    case 12:
        imageName = 'cloud_drizzle';
        break;

    case 13:
        imageName = 'cloud_rain';
        break;

    case 15:
    case 16:
    case 17:
    case 18:
        imageName = 'cloud_snow_alt';
        break;

    case 19:
        imageName = 'cloud_lightning';
        break;

    case 23:
    case 24:
    case 44:
        imageName = 'cloud_fog';
        break;

    case 25:
        imageName = 'cloud_wind';
        break;

    case 14: //freezing rain
    case 26: //ice
    case 27: //hail
        imageName = 'cloud_hail';
        break;

    case 30:
        imageName = 'moon';
        break;

    case 31:
    case 32:
    case 33:
        imageName = 'cloud_moon';
        break;

    case 21:
    case 34:
        imageName = 'cloud_moon_increasing';
        break;

    case 35:
        imageName = 'cloud_moon_decreasing';
        break;

    case 36:
        imageName = 'cloud_drizzle_moon_alt';
        break;

    case 37:
    case 38:
        imageName = 'cloud_snow_moon_alt';
        break;

    case 39:
        imageName = 'cloud_lightning_moon';
        break;
  }
  return imageName;
}

/* GET icon as SVG or PNG */
router.get('/', function(req, res, next) {
  var iconCode;
  if (req.query.code === null) {
    iconCode = 1;
    //console.log("Icon code not supplied, using 1");
  } else {
    iconCode = parseInt(req.query.code);
    //console.log("Icon code: " + iconCode);
  }

  var imageName = getImageName(iconCode);
  var fileName = path.join(__dirname, '/../climacons/') + imageName + '.svg';
  //console.log('sending icon file: ' + fileName);
  res.sendFile(fileName);
});

module.exports = router;
