// Dylan Harwell - GEOG 777 - Fall 2021 - Project 1

$(document).ready(function() {
    // Hide GLR Result link on load
    $("#glr-result").hide();

    // Create Leaflet map object and add widgets
    var map = L.map('map', {maxZoom: 18}).setView([44.71, -89.636], 7);
    L.control.scale({ metric: false, position: 'bottomright' }).addTo(map);
    L.control.browserPrint({ printModes: ['Portrait','Landscape'] }).addTo(map);
    htmlControlToLeafletControl(map, 'topright', 'analysis-widget')

    // Use ESRI vector tile Topo Basemap
    L.esri.Vector.vectorBasemapLayer('ArcGIS:ModernAntique', {
        apikey: 'AAPK3283bf26b755450ca3515b519c331123PasmpRKadVRG74CtjghVWetfSZNRP0GE8KPdHR_1bAJaTwaLZ6ti75TfwFUBJJPO'
    }).addTo(map);
    
    // Create map panes for layer ordering
    map.createPane('tracts');
    map.createPane('result');
    map.createPane('wells');

    // Add Cancer Tracts hosted feature service
    var cancerTractsLyr = L.esri.featureLayer({
        url: 'https://services.arcgis.com/HRPe58bUyBqyyiCt/ArcGIS/rest/services/Cancer_Tracts_DH/FeatureServer/0',
        style: tractStyle,
        pane: 'tracts'
    }).addTo(map);

    // Cancer tract popup
    cancerTractsLyr.bindPopup(function(layer) {
        return L.Util.template('<h3>Cancer Rate: {canrate}</h3>', layer.feature.properties);
    });

    // Add Nitrate Wells hosted feature service
    var wellLocationsLyr = L.esri.featureLayer({
        url: 'https://services.arcgis.com/HRPe58bUyBqyyiCt/ArcGIS/rest/services/Nitrate_DH/FeatureServer/0',
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                color: getWellColor(feature.properties.nitr_ran),
                radius: 0.1,
                pane: 'wells'
            });
        }
    }).addTo(map);

    // Create instance of result layer but do not add here
    var resultLyr = L.esri.featureLayer({
        url: 'https://services9.arcgis.com/OZ1IEVVMAIE73Ib2/arcgis/rest/services/project1_result/FeatureServer/0',
        style: resultStyle,
        pane: 'result'
    });

    // Create GLR result layer popup
    resultLyr.bindPopup(function(layer) {
        return L.Util.template(
            '<h2>Model Results</h2>' +
            '<h3>Predicted Average Nitrate: {zonal_stat}</h3>' +
            '<h3>Predicted Cancer Rate: {PREDICTED}</h3>' +
            '<h3>Actual Cancer Rate: {cancer_tra}</h3>' +
            '<h3>Standardized Residual: {STDRESID}</h3>',
            layer.feature.properties);
    });

    var legend = buildLegend([wellLocationsLyr, cancerTractsLyr]);
    legend.addTo(map);
    $('input[type="checkbox"]').prop('checked', true);
    $('.accordionlegend-section').removeClass('accordionlegend-section-hidden');
    $('.accordionlegend-legend').removeClass('accordionlegend-legend-hidden');

    // Hide error listener on decay coefficient input box
    $('#decay-coefficient').on('focus', function() {
        $('#error').hide();
    });

    // Run analysis listener on button and validation
    $('#run-analysis').on('click', function() {
        var decay_coefficient = parseFloat($('#decay-coefficient').val())
        if (isNaN(decay_coefficient) || decay_coefficient <= 0 || decay_coefficient >= 8) {
            $('#error').show();
        } else {
            $.ajax({
                type: 'POST',
                url: '/api/run-gp-service',
                data: {'decay-coefficient': decay_coefficient},
                success: function(response) {
                    if (response['gp-result'] === 'success'){
                        $("#glr-result").show();
                        legend.remove();
                        if ($('.newLegend')) { $('.newLegend').remove(); }
                        if (map.hasLayer(resultLyr)) { map.removeLayer(resultLyr); }
                        resultLyr.addTo(map);
                        var newLegend = buildLegend([wellLocationsLyr, cancerTractsLyr, resultLyr]);
                        newLegend.addTo(map);
                        newLegend.toggleLayer('Nitrate Level (PPM)', false);
                        newLegend.toggleLayer('Cancer Rate (%)', false);
                        $('.leaflet-control-accordionlegend').addClass('newLegend');
                        $('.accordionlegend-section').removeClass('accordionlegend-section-hidden');
                        $('.accordionlegend-legend').removeClass('accordionlegend-legend-hidden');
                        $('input[type="checkbox"][value="Standardized Residual"]').prop('checked', true);
                        // AccordionLegend plugin is BUGGY! Had to hack around with it :)
                    } else {
                        alert('An unknown geoprocessing error occured');
                    }
                },
                error: function(response) {
                    alert(response);
                }
            });
        }
    });
});

$(document).on({
    ajaxStart: function() {
        $("body").addClass("loading");
        $(".widget").prop("disabled", true);
        $("#glr-result").hide();
    },
    ajaxStop: function() {
        $("body").removeClass("loading");
        $(".widget").prop("disabled", false);
    }
});

function tractStyle(feature) {
    return {
        fillColor: getTractColor(feature.properties.canrate),
        weight: 1,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

function getTractColor(cancer_rate) {
    if (cancer_rate <= 0.05) {
        return '#EDF8FB';
    } else if (cancer_rate > 0.05 && cancer_rate <= 0.15) {
        return '#B3CDE3';
    } else if (cancer_rate > 0.15 && cancer_rate <= 0.30) {
        return '#8C96C6';
    } else if (cancer_rate > 0.30 && cancer_rate <= 0.5) {
        return '#8856A7';
    } else {
        return '#810F7C';
    }
}

function getWellColor(nitrate) {
    if (nitrate <= 2) {
        return '#FEF0D9';
    } else if (nitrate > 2 && nitrate <= 5) {
        return '#FDCC8A';
    } else if (nitrate > 5 && nitrate <= 10) {
        return '#E34A33';
    } else {
        return '#B30000';
    }
}

function resultStyle(feature) {
    return {
        fillColor: getResultColor(feature.properties.STDRESID),
        weight: 1,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

function getResultColor(std_residual) {
    if (std_residual <= -2.5) {
        return '#01665E';
    } else if (std_residual > -2.5 && std_residual <= -1.5) {
        return '#5AB4AC';
    } else if (std_residual > -1.5 && std_residual <= -0.5) {
        return '#C7EAE5';
    } else if (std_residual > -0.5 && std_residual <= 0.5) {
        return '#F7F7F7';
    } else if (std_residual > 0.5 && std_residual <= 1.5) {
        return '#BFBBDA';
    } else if (std_residual > 1.5 && std_residual <= 2.5) {
        return '#715AA0';
    } else {
        return '#2D004B';
    }
}

// Create custom Leaflet control
function htmlControlToLeafletControl(map, position, element) {
    var NewControl = L.Control.extend({
        options: {
            position: position
        },
        onAdd: function() {
            var newControl = L.DomUtil.get(element);
            L.DomEvent.disableClickPropagation(newControl);
            L.DomEvent.disableScrollPropagation(newControl);
            $(newControl).addClass('leaflet-bar');
            return newControl;
        }
    });
    map.addControl(new NewControl());
}

function buildLegend(layers) {
    if (layers.length == 2) {
        var legend = new L.Control.AccordionLegend({
            position: 'bottomleft',
            content: legendContent(layers[0], layers[1])
        });
    } else if (layers.length == 3) {
        var legend = new L.Control.AccordionLegend({
            position: 'bottomleft',
            content: legendContent(layers[0], layers[1], layers[2])
        });
    }
    return legend;
}

// Build legend object for accordion legend plugin
function legendContent(wells, tracts, result=undefined) {
    var legend_content = [];
    var well_content = {
        'title': 'Well Locations',
        layers: [
            {
                'title': 'Nitrate Level (PPM)',
                'layer': wells,
                'opacityslider': false,
                'legend': [
                    { 'type':'circle', 'color':'#FEF0D9', 'text':'< 2' },
                    { 'type':'circle', 'color':'#FDCC8A', 'text':'2 - 5' },
                    { 'type':'circle', 'color':'#E34A33', 'text':'5 - 10' },
                    { 'type':'circle', 'color':'#B30000', 'text':'> 10' }
                ]
            }
        ]
    };
    var tracts_content = {
        'title': 'Census Tracts',
        layers: [
            {
                'title': 'Cancer Rate (%)',
                'layer': tracts,
                'opacityslider': false,
                'legend': [
                    { 'type':'square', 'color':'#EDF8FB', 'text':'< 5' },
                    { 'type':'square', 'color':'#B3CDE3', 'text':'5 - 15' },
                    { 'type':'square', 'color':'#8C96C6', 'text':'15 - 30' },
                    { 'type':'square', 'color':'#8856A7', 'text':'30 - 50' },
                    { 'type':'square', 'color':'#810F7C', 'text':'> 50' }
                ]
            }
        ]
    };
    var result_content = {
        'title': 'Analysis Result',
        layers: [
            {
                'title': 'Standardized Residual',
                'layer': result,
                'opacityslider': false,
                'legend': [
                    { 'type':'square', 'color':'#2D004B', 'text':'< -2.5' },
                    { 'type':'square', 'color':'#715AA0', 'text':'-2.5 - -1.5' },
                    { 'type':'square', 'color':'#BFBBDA', 'text':'-1.5 - -0.5' },
                    { 'type':'square', 'color':'#F7F7F7', 'text':'-0.5 - 0.5' },
                    { 'type':'square', 'color':'#C7EAE5', 'text':'0.5 - 1.5' },
                    { 'type':'square', 'color':'#5AB4AC', 'text':'1.5 - 2.5' },
                    { 'type':'square', 'color':'#01665E', 'text':'> 2.5' }
                ]
            }
        ]
    };
    if (result != undefined) {
        legend_content.push(well_content);
        legend_content.push(result_content);
        legend_content.push(tracts_content);
    } else {
        legend_content.push(well_content);
        legend_content.push(tracts_content);
    }
    return legend_content;
}