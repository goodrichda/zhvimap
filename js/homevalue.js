function createMap(){
    //create the map
    var map = L.map('map', {
        center: [39, -96],
        zoom: 4
    });
    
    //create layer group for imagery tiles
    var tlgroup = L.layerGroup();
    
    //create feature group for overlay
    var olgroup = L.featureGroup();
    
    
    var imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    }).addTo(tlgroup);
    
    var labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    }).addTo(tlgroup);
    
        streets = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    }).addTo(map);
    
    //add base maps to tile layer group
    var baseMaps = {
        "Streets": streets,
        "Imagery": tlgroup
    };
    
    //get colors for overlay map
    function getColor(d){
        return d < 0 ? '#EDF8FB': d < 48375 ? '#B2E2E2': d < 54909 ? '#66C2A4': d < 74168 ? '#2CA25F':'#006D2C';
    }
    
    //create style for overlay map
    function style(feature){
        return{
            weight: 2,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7,
            fillColor: getColor(feature.properties.MedIncome)
        };
    }
    
    //create popup for median income layer
    function statepopup (feature, layer){
        layer.bindPopup("<p><h3>" + feature.properties.NAME + "</h3></p><p><u>Median Household Income</u></p><p>$" + feature.properties.MedIncome + "</p>");
    }
    
    //add median income geojson
    var mdincomeLayer = L.geoJson(mdincome,{
        style: style,
        onEachFeature: statepopup,
    }).addTo(olgroup);
    
    var overlaymaps = {
        "Median Income": olgroup
    }
    
    //add control layers
    L.control.layers(baseMaps,overlaymaps,{
        collapsed:false
    }).addTo(map);

    //call getData function
    getData(map);
};

//calculate radius for proportional symbols
function calcPropRadius(attValue) {
    //scale factor to adjust symbol size evenly
    var scaleFactor = .002;
    //area based on attribute value and scale factor
    var area = attValue * scaleFactor;
    //radius calculated based on area
    var radius = Math.sqrt(area/Math.PI);

    return radius;
};

//create popup for point layer
function Popup(properties, attribute, layer, radius){
    this.properties = properties;
    this.attribute = attribute;
    this.layer = layer;
    this.date = attribute.split("_")[1];
    this.month = this.date.slice(0,-4);
    this.year = this.date.substring(this.date.length - 4, this.date.length);
    this.zhomeval = this.properties[attribute];
    this.content = "<h2><b>" + this.properties.RegionName + "</b></h2>" + "<h2>$" + this.zhomeval + "</h2><p>" + "Zillow Home Value Index" + "</p>" + this.month + " " + this.year + "</p>" ;
    
    this.bindToLayer = function(){
        this.layer.bindPopup(this.content, {
            offset: new L.Point(0,-radius)
        });
    };
};

 //function to convert markers to circle markers
function pointToLayer(feature, latlng, attributes){
    
    var attribute = attributes[0];

    //create marker options
    var options = {
        fillColor: "#1277e1",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    //For each feature, determine its value for the selected attribute
    var attValue = Number(feature.properties[attribute]);

    //Give each feature's circle marker a radius based on its attribute value
    options.radius = calcPropRadius(attValue);

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);

    var popup = new Popup(feature.properties, attribute, layer, options.radius);
    
    popup.bindToLayer();
    
    layer.on({
        mouseover: function(){
            this.openPopup();
        },
        mouseout: function(){
            this.closePopup();
        }
    });

    //return the circle marker to the L.geoJson pointToLayer option
    return layer;
};

function processData(data){
    //empty array to hold attributes
    var attributes = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    //push each attribute name into attributes array
    for (var attribute in properties){
        //only take attributes with population values
        if (attribute.indexOf("ZHVI") > -1){
            attributes.push(attribute);
        };
    };

    //check result
    console.log(attributes);

    return attributes;
};

function createPropSymbols(data, map, attributes){
    
    //create a Leaflet GeoJSON layer and add it to the map
     L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(map);
};


//update proportional symbols based on data
function updatePropSymbols(map, attribute){
    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            //access feature properties
            var props = layer.feature.properties;

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);

            //Example 1.3 line 6...in UpdatePropSymbols()
            var popup = new Popup(props, attribute, layer, radius);

            //add popup to circle marker
            popup.bindToLayer();
        };
    });

    updateLegend(map, attribute);
};

//create legend from data
function createLegend(map, attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function (map) {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-control-container');

            //add temporal legend div to container
            $(container).append('<div id="temporal-legend">')

            //Example 3.5 line 15...Step 1: start attribute legend svg string
            var svg = '<svg id="attribute-legend" width="160px" height="60px">';

            // //array of circle names to base loop on
            // var circles = ["max", "mean", "min"];

            //object to base loop on...replaces Example 3.10 line 1
            var circles = {
                max: 20,
                mean: 40,
                min: 60
            };


            //loop to add each circle and text to svg string
            for (var circle in circles){
                //circle string
                svg += '<circle class="legend-circle" id="' + circle + '" fill="#1277e1" fill-opacity="0.8" stroke="#000000" cx="30"/>';

                //text string
                svg += '<text id="' + circle + '-text" x="65" y="' + circles[circle] + '"></text>';
            };

            //close svg string
            svg += "</svg>";
            console.log(svg);

            //add attribute legend svg to container
            $(container).append(svg);

            return container;
        }
    });

    map.addControl(new LegendControl());

    updateLegend(map, attributes[0]);
};

//Calculate the max, mean, and min values for a given attribute
function getCircleValues(map, attribute){
    //start with min at highest possible and max at lowest possible number
    var min = Infinity,
        max = -Infinity;

    map.eachLayer(function(layer){
        //get the attribute value
        if (layer.feature){
            var attributeValue = Number(layer.feature.properties[attribute]);

            //test for min
            if (attributeValue < min){
                min = attributeValue;
            };

            //test for max
            if (attributeValue > max){
                max = attributeValue;
            };
        };
    });

    //set mean
    var mean = (max + min) / 2;

    //return values as an object
    return {
        max: max,
        mean: mean,
        min: min
    };
};

function updateLegend(map, attribute){
    //create content for legend
    var datetext = attribute.split("_")[1];
    var month = datetext.substr(0, datetext.length -4);
    var year = datetext.substr(datetext.length - 4);
    var content = "Home Value in <br>" + month + " " + year;

    //replace legend content
    $('#temporal-legend').html(content);

    //get the max, mean, and min values as an object
    var circleValues = getCircleValues(map, attribute);

    for (var key in circleValues){
        //get the radius
        var radius = calcPropRadius(circleValues[key]);

        //Step 3: assign the cy and r attributes
        $('#'+key).attr({
            cy: 59 - radius,
            r: radius
        });

        //Step 4: add legend text
        $('#'+key+'-text').text("$" + Math.round(circleValues[key]*100)/100);
    };
};

//create sequence control
function createSequenceControls(map, attributes){
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        
        onAdd: function (map){
        var container = L.DomUtil.create('div', 'sequence-control-container');
        
        $(container).append('<input class="range-slider" type="range">');
            
        $(container).append('<button class="skip" id="reverse" title="Reverse">Reverse</button>');
        $(container).append('<button class="skip" id="forward" title="Forward">Skip</button>');
            
        L.DomEvent.disableClickPropagation(container);
        
        return container;
    }
    });
    
    map.addControl(new SequenceControl());
    
    //set slider attributes
	$('.range-slider').attr({
		max: 43,
		min: 0,
		value: 0,
		step: 1
	});

    $('#reverse').html('<img src="img/reverse.png">');
	$('#forward').html('<img src="img/forward.png">');

	//click listener for buttons
	$('.skip').click(function(){

		//get the old index value
		var index = $('.range-slider').val();

		//increment or decriment depending on button clicked
		if ($(this).attr('id') == 'forward'){
			index++;
			//if past the last attribute, wrap around to first attribute
			index = index > 43 ? 0 : index;
		} else if ($(this).attr('id') == 'reverse'){
			index--;
			//if past the first attribute, wrap around to last attribute
			index = index < 0 ? 42 : index;
		};

		//update slider
		$('.range-slider').val(index);

		//pass new attribute to update symbols
		updatePropSymbols(map, attributes[index]);
	});

	//input listener for slider
	$('.range-slider').on('input', function(){
		//get the new index value
		var index = $(this).val();

		//pass new attribute to update symbols
		updatePropSymbols(map, attributes[index]);
	});
    
    
};


//Step 2: Import GeoJSON data
function getData(map){
    //load the data
    $.ajax("data/zhvi2.geojson", {
        dataType: "json",
        success: function(response){
            var attributes = processData(response);
            createPropSymbols(response, map, attributes);
            createSequenceControls(map, attributes);
            createLegend(map, attributes);
        }
    });
};


$(document).ready(createMap);