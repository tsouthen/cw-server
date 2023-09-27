var express = require('express');
var router = express.Router();
var request = require('request');
var parseString = require('xml2js').parseString;
var csv = require('csvtojson');
var removeDiacritics = require('diacritics').remove;
var fs = require('fs');
var path = require('path');
var geolib = require('geolib');

var fileName = path.join(path.resolve(path.join(__dirname, '/../data')), 'sitelist.json');
var url = "https://dd.weather.gc.ca/citypage_weather/xml/siteList.xml";

getLastModified = function(uri, callback) {
  request.head({uri:uri}, function(error, response, body) {
    if (error) {
      callback(error, null);
      return;
    }
    var lastMod = new Date(response.headers['last-modified']);

    console.log('Last modified:' + lastMod.toString());
    callback(null, lastMod);
  });
}

loadXml = function(uri, callback) {
  request.get({uri:url, encoding: 'latin1'}, function(error, response, body) {
    if (error) {
      callback(error, null);
      return;
    }
    parseString(body, {mergeAttrs: true, explicitArray: false}, function(err, result) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, result);
      }
    });
  });
}

formulateResults = function(siteListJson) {
  var results = {
    sites : {},
    provinces : {},
    names : {}
  };
  siteListJson.siteList.site.forEach(element => {
    //formulate site data to store
    var siteData = { 'name' : element.nameEn, 'province' : element.provinceCode };
    if (element.nameFr !== element.nameEn) {
      siteData.nameFr = element.nameFr;
    }
    results.sites[element.code] = siteData;

    //add site to province array
    if (results.provinces[element.provinceCode] === undefined) {
      results.provinces[element.provinceCode] = [];
    }
    results.provinces[element.provinceCode].push(element.code);

    //add names to index
    var names = [ removeDiacritics(siteData.name).toLowerCase() ];
    if (siteData.nameFr) {
      names.push(removeDiacritics(siteData.nameFr).toLowerCase());
    }
    names.forEach(name => {
      var firstLetter = name.substr(0, 1);
      if (results.names[firstLetter] === undefined) {
        results.names[firstLetter] = [];
      }
      results.names[firstLetter].push( { name : name, code : element.code });
    });
  });

  //sort name indexes
  for (var letterKey in results.names) {
    if (results.names.hasOwnProperty(letterKey)) {
      results.names[letterKey].sort(function(a, b) {
        if (a.name < b.name)
          return -1;
        else if (a.name > b.name)
          return 1;
        else
          return 0;
      });
    }
  }
  return results;
}

loadCoordinates = function(results, callback) {
  csv({ noheader: true })
  .fromStream(request.get('https://dd.weather.gc.ca/citypage_weather/docs/site_list_en.csv'))
  .on('csv', (csvRow)=> {
    var code = csvRow[0];
    if (csvRow[3] && csvRow[4] && results.sites[code]) {
      //remove N from lat
      //remove W from lon and add neg
      results.sites[code].latitude = parseFloat(csvRow[3].slice(0, -1));
      results.sites[code].longitude = -parseFloat(csvRow[4].slice(0, -1));
    }
  })
  .on('done', ()=> {
    //provide zero lat/lon for any sites without lat/lon
    Object.keys(results.sites).map(function(key) {
      if (results.sites[key].latitude === undefined) {
        results.sites[key].latitude = 0;
        results.sites[key].longitude = 0;
      }
    });
    callback(null, results);
  })
  .on('error', (err)=> {
    callback(err, null);
  });
}

loadCachedData = function(uri, fileName, callback) {
  getLastModified(uri, function(error, lastModDate) {
    if (error) {
      lastModDate = 0; //allows us to use existing sitelist file
    }
    if (fs.existsSync(fileName) && lastModDate < fs.statSync(fileName).mtime) {
      var data = JSON.parse(fs.readFileSync(fileName, 'latin1'));
      callback(null, data, true);
      return;
    }
    loadXml(uri, function(error, results) {
      if (error) {
        callback("Error loading citypage weather. Url: " + url + " Error: " + error);
        return;
      }
      callback(null, results, false);
      //fs.writeFileSync(fileName, JSON.stringify(results, null, 4), { encoding : 'latin1'});
    });
  });
}

loadData = function(callback) {
  loadCachedData(url, fileName, function(error, results, cached) {
    if (error) {
      callback(error, null);
      return;
    }
    if (!cached) {
      var results = formulateResults(results);

      //load lat/lon from csv file
      loadCoordinates(results, function(error, results) {
        if (error) {
          callback("Error loading coordinates: " + error);
          return;
        }
        fs.writeFileSync(fileName, JSON.stringify(results, null, 4), { encoding : 'latin1'});
      });
    }
    callback(null, results);
  });
}

getSites = function(siteList, matches) {
  var sites = [];
  if (siteList === undefined || matches === undefined) {
    return sites;
  }
  matches.forEach(value => {
    var code = value.code;
    if (code === undefined) {
      code = value;
    }
    var site = siteList.sites[code];
    sites.push({ code: code, name: site.name, nameFr: site.nameFr, province: site.province} );
  });
  return sites;
}

searchSites = function(siteList, search) {
  var sites = [];
  var entry = siteList.names[search[0]];
  if (entry) {
    var matches = [];
    if (search.length === 1) {
      matches = entry;
    } else {
      matches = entry.filter(value => value.name.startsWith(search));
    }
    sites = getSites(siteList, matches);
  }
  return sites;
}

router.get('/', function(req, res, next) {
  loadData(function(err, results) {
    if (err) {
      res.send(err);
      return;
    }
    //use query params to figure out what to send back
    var search = req.query["search"];
    var province = req.query["province"];
    var lat = req.query["lat"] || '49.673513';
    var lon = req.query["lon"] || '-124.928266';
    var limit = req.query["limit"] || 1;

    if (search !== undefined) {
      search = removeDiacritics(search).toLowerCase();
      console.log("Searching for: " + search);
      var sites = searchSites(results, search);
      res.send(sites);
    } else if (province !== undefined) {
      console.log("Province query: " + province);
      var sites = getSites(results, results.provinces[province.toUpperCase()]);
      res.send(sites);
    } else if (lat !== undefined && lon !== undefined) {
      var nearest = geolib.findNearest({latitude: parseFloat(lat), longitude: parseFloat(lon)}, results.sites, 0, limit);
      var matches = [];
      if (Array.isArray(nearest)) {
        nearest.forEach(val => matches.push(val.key));
      } else if (nearest !== undefined) {
        matches.push(nearest.key);
      }
      res.send(getSites(results, matches));
    } else {
      console.log("No query, sending complete sitelist");
      res.send(results);
    }
  });
});

module.exports = router;
module.exports.loadSiteData = loadData;
module.exports.searchSites = searchSites;
module.exports.getLastModified = getLastModified;
