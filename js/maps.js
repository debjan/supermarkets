var mapboxAttribution = 'Imagery from <a href="http://mapbox.com/about/maps/">MapBox</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>';
var at = 'pk.eyJ1IjoiZGViamFuIiwiYSI6ImNpbTVpb3NnazAwMzR3Mm0zM2RjcmxqdmQifQ.STyl8E9y0xLok1CD6lxiqQ';
var light = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={access_token}', {
        attribution: mapboxAttribution,
        subdomains: 'abcd',
        id: 'mapbox.light',
        access_token: at,
        maxZoom: 18
    }),
    dark = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={access_token}', {
        attribution: mapboxAttribution,
        subdomains: 'abcd',
        id: 'mapbox.dark',
        access_token: at,
        maxZoom: 18
    }),
    outdoors = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={access_token}', {
        attribution: mapboxAttribution,
        subdomains: 'abcd',
        id: 'mapbox.outdoors',
        access_token: at,
        maxZoom: 18
    }),
    empty = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.{ext}', {
        subdomains: 'abcd',
        ext: 'png',
        maxZoom: 20,
        opacity: 0
    });

var zoom_level = 13;

// Data layers
var polygonsLayer = new L.LayerGroup();
var linesLayer = new L.LayerGroup();
var pointsLayer = new L.LayerGroup();

// Data layer styles
var pointStyle = {
    radius: 4,
    weight: 2,
    stroke: true,
    fillOpacity: 1
};
var highlight = {
    color: '#000',
    weight: 3,
    stroke: true,
    fillOpacity: 0.5
};

// Voronoi polygons
var polygons;
$.getJSON("data/voronoi.json", function(data) {
    polygons = L.geoJson(data, {
        style: function(feature) {
            return {
                color: "#fff",
                fillColor: feature.properties.color
            };
        },
        onEachFeature: function(feature, layer) {
            layer.on({
                mouseover: highlightFeatures,
                mouseout: resetHighlights,
                click: zoomToFeatures
            });
        }
    });
    polygons.addTo(polygonsLayer);
    map.fitBounds(polygons.getBounds());
});

// Delaunay triangulation
$.getJSON("data/delaunay.json", function(data) {
    L.geoJson(data, {
        onEachFeature: function(feature, layer) {
            layer.on({
                mouseover: highlightFeatures,
                mouseout: resetHighlights,
                click: zoomToFeatures
            });
        }
    }).addTo(linesLayer);
});

// Supermarket locations
$.getJSON("data/locations.json", function(data) {
    L.geoJson(data, {
        pointToLayer: function(feature, latlng) {
            return new L.CircleMarker(latlng,
                L.Util.extend(pointStyle, {
                    color: feature.properties.color
                })
            );
        },
        onEachFeature: function(feature, layer) {
            layer.on({
                mouseover: highlightFeatures,
                mouseout: resetHighlights,
                click: centerToFeature
            });
        }
    }).addTo(pointsLayer);
});

// Map initialization
var baseMaps = {
    "Колор позадина": outdoors,
    "Светла позадина": light,
    "Темна позадина": dark,
    "Без позадина": empty
};

var overlayMaps = {
    "Позициони точки": pointsLayer,
    "Вороноев дијаграм&nbsp;<a href='https://en.wikipedia.org/wiki/Voronoi_diagram' title='https://en.wikipedia.org/wiki/Voronoi_diagram'><img src='https://upload.wikimedia.org/wikipedia/commons/b/b0/Wikipedia-favicon.png'></a>": polygonsLayer,
    "Делониева триангулација&nbsp;<a href='https://en.wikipedia.org/wiki/Delaunay_triangulation' title='https://en.wikipedia.org/wiki/Delaunay_triangulation'><img src='https://upload.wikimedia.org/wikipedia/commons/b/b0/Wikipedia-favicon.png'></a>": linesLayer
};

var map = L.map('map', {
    zoomControl: true,
    layers: [outdoors, pointsLayer, polygonsLayer]
});

map.on('overlayadd', function(e) {
    // order layers
    for (var key in e.target._layers) {
        var layer = e.target._layers[key];
        if (layer.hasOwnProperty('feature')) {
            if (layer.feature.geometry.type == "Point") layer.bringToFront();
            if (layer.feature.geometry.type == "Polygon") layer.bringToBack();
        }
    }
});

var hidden_layers = [];
map.on('zoomend', updateZoom);

function updateZoom(e) {
    // show/hide on zoom change
    zoom_level = map.getZoom();
    var zoom_limit = 9;
    $.each([polygonsLayer, linesLayer, pointsLayer], function(i, layer) {
        if (layer._map) {
            var layers = layer.getLayers()[0].getLayers();
            // layer is visibe
            if (zoom_level <= zoom_limit) {
                map.removeLayer(layer);
                hidden_layers.push(layer);
            }
        } else if (zoom_level > zoom_limit) {
            // show hidden layer if any
            $.each(hidden_layers, function(i, layer) {
                map.addLayer(layer);
            });
            hidden_layers = [];
        }
    });
}

L.control.layers(baseMaps, overlayMaps).addTo(map);

// Custom methods
function zoomToFeatures(e) {
    var zoomGroup = new L.featureGroup();
    var ep = e.target.feature.properties;
    var geoType = e.target.feature.geometry.type;
    for (var key in map._layers) {
        var layer = map._layers[key];
        if (layer.hasOwnProperty('feature')) {
            var lp = layer.feature.properties;
            if (layer.feature.geometry.type == geoType) {
                if ((geoType == 'LineString' && lp.source == ep.source && lp.target == ep.target) ||
                    (geoType != 'LineString' && lp.parent == ep.parent)) {
                    zoomGroup.addLayer(layer);
                }
            }
        }
    }
    map.fitBounds(zoomGroup.getBounds());
}

function centerToFeature(e) {
    map.setView(e.target.getLatLng());
}

function highlightFeatures(e) {
    var ef = e.target.feature;
    var match = function(lf, key) {
        return ef.properties[key] == lf.properties[key];
    };
    for (var key in map._layers) {
        var layer = map._layers[key];
        if (layer.hasOwnProperty('feature') && layer.feature.geometry.type == ef.geometry.type) {
            var lf = layer.feature;
            if (ef.geometry.type != 'LineString') {
                layer.setStyle({
                    stroke: false
                });
            }
            // Point highlight
            if (lf.geometry.type == 'Point' && match(lf, 'parent')) {
                layer.setStyle(L.Util.extend(highlight, {
                    fillColor: lf.properties.color
                }));
                infoControl.update(ef.properties.name);

            // Line highlight
            } else if (lf.geometry.type == 'LineString') {
                if (match(lf, 'source') && match(lf, 'target')) {
                    layer.setStyle({
                        color: '#d27'
                    });
                    infoControl.update(ef.properties.source + ' - ' + ef.properties.target);
                } else {
                    layer.setStyle({
                        stroke: false
                    });
                }

            // Polygon highlight
            } else if (lf.geometry.type == 'Polygon' && match(lf, 'parent')) {
                layer.setStyle(highlight);
                layer.setStyle({
                    fillColor: lf.properties.color
                });
                infoControl.update(ef.properties.parent);
            }
        }
    }
}

function resetHighlights(e) {
    var ef = e.target.feature;
    for (var key in map._layers) {
        var layer = map._layers[key];
        if (layer.hasOwnProperty('feature') && layer.feature.geometry.type == ef.geometry.type) {
            var lf = layer.feature;
            if (lf.geometry.type == "Polygon") {
                layer.setStyle(L.Polygon.prototype.options);
                layer.setStyle({
                    color: '#fff',
                    fillColor: lf.properties.color
                });
            } else if (lf.geometry.type == "Point") {
                pointStyle.color = lf.properties.color;
                layer.setStyle(pointStyle);
            } else if (lf.geometry.type == "LineString") {
                if (layer.options.color == '#d27') {
                    layer.setStyle(L.Path.prototype.options);
                    layer.setStyle({
                        color: '#d72'
                    });
                } else {
                    layer.setStyle(L.Path.prototype.options);
                }
            }
            infoControl.update();
        }
    }
}

function printFeatures(e, prop) {
    infoControl.update(e.target.feature.properties[prop]);
}

// Zoom reset control
var homeControl = L.Control.extend({
    options: {
        position: 'topleft'
    },
    onAdd: function(map) {
        this._div = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar leaflet-control');
        this._div.innerHTML = '<a title="Иницијален размер" href="#"><img src="style/images/home.png" ></a>';
        this._div.onclick = function() {
            map.fitBounds(polygons.getBounds());
        };
        return this._div;
    }
});

map.addControl(new homeControl());

// Info control
var infoControl = L.Control.extend({
    options: {
        position: 'bottomleft'
    },
    onAdd: function(map) {
        this._div = L.DomUtil.create('div', 'info leaflet-control-attribution leaflet-control');
        this._div.innerHTML = 'Data: zk.mk';
        return this._div;
    }
});

infoControl.update = function(msg) {
    $('.info').html(msg || 'Data: zk.mk');
};

map.addControl(new infoControl());
