var express = require('express');
var router = express.Router();
var request = require('request');
var parseString = require('xml2js').parseString;
var loadSiteData = require('./sitelist.js').loadSiteData;
var searchSites = require('./sitelist.js').searchSites;

/* GET forecast JSON. */
router.get('/', function(req, res, next) {
  var cityCode = req.query["citycode"]; // || 's0000656';
  var search = req.query["search"];
  if ((cityCode === undefined || cityCode.length === 0) &&
      (search === undefined || search.length === 0)) {
    res.send("Missing query parameter: you must supply citycode or search parameter");
    return;
  }
  var lang = req.query["lang"] || 'e';

  loadSiteData(function(err, siteData) {
    if (err) {
      res.send(err);
      return;
    }
    var site;
    if (cityCode !== undefined) {
      site = siteData.sites[cityCode];
      if (site === undefined) {
        res.send("Unknown citycode: " + cityCode);
        return;
      }
    } else if (search !== undefined) {
      sites = searchSites(siteData, search);
      if (sites.length === 0) {
        res.send("Search returned no sites: " + search);
        return;
      }
      site = sites[0];
    }
    var url = "https://dd.weather.gc.ca/citypage_weather/xml/" + site.province + "/" + site.code + "_" + lang + ".xml";
    //TODO: get last mod date of URL and use local cache if it's newer
    console.log(`Requesting url: ${url}`);
    request({uri: url, encoding: 'latin1'}, function(error, response, body) {
      if (error) {
        res.send("Error loading citypage weather. Url: " + url + " Error: " + error);
        return;
      } else if (response.statusCode !== 200) {
        res.send(`Error code returned: ${response.statusCode}, message: ${response.statusMessage}`);
        return;
      }
      var json = parseString(body, {mergeAttrs: true, explicitArray: false}, function(err, result) {
        if (err) {
          res.send("Error converting XML to JS: " + err);
          return;
        }
        if (result.siteData) {
          if (result.siteData.forecastGroup) {
            var fg = result.siteData.forecastGroup;

            //get the timeStamp in UTC and put it in the first forecast item
            for (var idx = 0; idx < fg.dateTime.length; idx++) {
              if (fg.dateTime[idx].zone === "UTC") {
                fg.forecast[0].timeStamp = fg.dateTime[idx].timeStamp;
                break;
              }
            }

            //get the current conditions and create a "Now" forecast
            var currCond = result.siteData.currentConditions;
            for (var idx = 0; idx < currCond.dateTime.length; idx++) {
              if (fg.dateTime[idx].zone === "UTC") {
                currCond.timeStamp = currCond.dateTime[idx].timeStamp;
                break;
              }
            }
            delete currCond.dateTime;
            currCond.period = { '_' : "Now" };
            fg.forecast.splice(0, 0, currCond);

            res.send(fg.forecast);
          } else {
            res.send(result.siteData);
          }
        } else {
          res.send(result);
        }
      });
    });
  });
});

module.exports = router;
