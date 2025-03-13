const test_coords = [{name: 'Newark', latitude: 39.6837, longitude: -75.7497}, {name: 'Olympia', latitude: 46.9733, longitude: -122.9033}, {name: 'ANNETTE ISLAND', latitude: 55.0389, longitude:-131.5786}, {name: 'Juneau', latitude: 58.3005, longitude:-134.4021}]       // Coordinates for some test coordinates For testing purposes, compare visually

// Functions and Variables for Data Processing
const valid_states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']

const data_options = [
    {name: 'Temperature', fullname: 'Average Temperature Across Observations (F)'},
    {name: 'Snowfall', fullname: 'Snowfall Across Observations (inches)'},
    {name: 'Precipitation', fullname: 'Precipitation (inches)'},
    {name: 'Windspeed', fullname: 'Fastest 5-Second Wind Speed Across Daily Observations (miles/hour)'}
    ];

let num_observations= [], data_var = data_options[0], min_observations = 25;


function get_data(datapoint) {
    return "Not implemented yet";
}

// The CSV takes the following format: station,state,latitude,longitude,elevation,date,TMIN,TMAX,TAVG,AWND,WDF5,WSF5,SNOW,SNWD,PRCP

// SVG canvas variables
const width = 975;
const height = 610;

const svg = d3.select('#vis').append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");

const g = svg.append("g");


// Initiialize dynamic behavior
const transition_time = 1000;

const max_zoom = 8;
const min_zoom = 1;

const zoom = d3.zoom()
    .scaleExtent([min_zoom, max_zoom])
    //.translateExtent([[0, 0], [width, height]])
    .on("zoom", zoomed);


let allow_zoom = true;

function zoomed(event) {
    const {transform} = event;

    if (allow_zoom) {
        g.attr("transform", transform);
        g.attr("stroke-width", 1 / transform.k);
    }
    
}

svg.call(zoom);

svg.on('click', function (event, d) {    
    svg.transition(transition_time).call(zoom.scaleTo, 1).transition(transition_time).call(zoom.translateTo, width / 2, height / 2);
    g.attr('transform', `translate(${0},${0}) scale(1)`);

    allow_zoom = true;
});


// Initialize path for map drawing
const path = d3.geoPath();

const projection = d3.geoAlbersUsa()
    .scale(1300)
    .translate([487.5, 305]);


// Begin Page Creation
async function init() {
    try {
        // Load geographic data
        let us = await d3.json("./data/states-albers-10m.json");
        let weather_data = await d3.csv("./data/weather.csv");
        
        // Verify data loading
        //console.log('map data:', us.objects.states);
        //console.log('weather data:', weather_data);

        // Lets clean up the weather data
        // 1: due to map limitations, remove all data not within the 50 states of the US
        weather_data = weather_data.filter(d => !(valid_states.find(x => x == d.state) === undefined));

        // 2: to avoid duplicate points, organize the data by station, instead of individual report
        weather_data = weather_data.sort((a, b) => a.station < b.station);

        let station_data = []

        function reducer(accum, curr) {
            currWeather = {
                date: curr.date,
                TMIN: curr.TMIN,
                TMAX: curr.TMAX,
                TAVG: curr.TAVG,
                AWND: curr.AWND,
                WDF5: curr.WSF5,
                SNOW: curr.SNOW,
                SNWD: curr.SNWD,
                PRCP: curr.PRCP
            }

            if (accum.station == curr.station) {
                accum.weather.push(currWeather);
                return accum;
            } else {
                station_data.push(accum);
                let [x, y] = projection([curr.longitude, curr.latitude]);

                newAccum = {
                    station: curr.station,
                    latitude: curr.latitude,
                    longitude: curr.longitude,
                    x: x,
                    y: y,
                    elevation: curr.elevation,
                    state: curr.state,
                    weather: [currWeather]
                }

                return newAccum
            }
        }        

        let [x, y] = projection([weather_data[0].longitude, weather_data[0].latitude]);

        let initial = {
            station: weather_data[0].station,
            latitude: weather_data[0].latitude,
            longitude: weather_data[0].longitude,
            x: x,
            y: y,
            elevation: weather_data[0].elevation,
            state: weather_data[0].state,
            weather: []
        };

        final_station = weather_data.reduce(reducer, initial);
        station_data.push(final_station);

        console.log("Old length: " + weather_data.length);
        console.log("New length: " + station_data.length);

        num_observations = station_data.map(d => d.weather.length)

        console.log('Each station has an average of: ' + num_observations.reduce((accum, curr) => accum + curr, 0) / num_observations.length + ' observations');
        console.log('The highest number of observations was: ' + num_observations.reduce((accum, curr) => (accum < curr)? curr : accum));
        console.log(num_observations);
        // Create visualization
        createVis(us, station_data);
        setupSelector(station_data);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}


// Create User Interaction Tools
function setupSelector(station_data){
    d3.select("#value").text(min_observations);

    let slider = d3
        .sliderHorizontal()
        .min(d3.min(num_observations))
        .max(d3.max(num_observations))
        .step(1)
        .width(width)
        .displayValue(false)
        .default(min_observations)
        .on('onchange', (val) => {
            d3.select('#value').text(val);
            min_observations = +val;
            updateVis(station_data);
        });

    d3.select('#slider')
        .append('svg')
        .attr('width', width)
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)')
        .call(slider);

    d3.select('#dataVar').selectAll('myOptions')
        .data(data_options)
        .enter()
        .append('option')
        .text(d => d.name)
        .attr('value', d => d.name)
        .on('change', function (event) {
            
        })
    
    
    
}


function createVis(us, data) {    

    const states = g.append("g")
        .attr("fill", "#ddd")
        //.attr("cursor", "pointer")
        .selectAll("path")
        .data(topojson.feature(us, us.objects.states).features)
        .join("path")
        .attr("d", path);
  
    states.append("title")
        .text(d => d.properties.name);

    g.append("path")
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .attr("d", path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)));
    
    
    
    updateVis(data);
}



function updateVis(weather_data) {
    function coord_to_plot(datapoint) {
        //let [x, y] = projection([datapoint.longitude, datapoint.latitude]);

        return {
            station: datapoint.station,
            state: datapoint.state,
            long: datapoint.longitude,
            lat: datapoint.latitude,
            x: datapoint.x,
            y: datapoint.y,
            data: get_data(datapoint)
        }
    }

    p_coords = weather_data.filter(d => d.weather.length >= min_observations).map(d => coord_to_plot(d));


    g.selectAll('.points')
        .data(p_coords)
        .join(
            function (enter) {
                return enter
                    .append('circle')
                    .attr('class', 'points')
                    .attr('r', 0)
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .attr('r', 4)
                    .attr('fill', 'red')
                    .style('stroke', 'black')
                    .style('stroke-width', '1px')
                    .on('mouseover', function (event, d) {
                        d3.select('#tooltip')
                            .style('display', 'block')
                            .html(`<strong>${d.station}</strong><br/>
                                    ${Math.abs(d.lat)}&deg${(d.lat > 0)? 'N' : 'S'}, ${Math.abs(d.long)}&deg${(d.long > 0)? 'E':'W'}<br/>
                                    State: ${d.state}<br/>
                                    `)
                            .style("left", (event.pageX + 20) + "px")
                            .style("top", (event.pageY - 28) + "px");
                        
                        d3.select(this)
                            .attr('r', 7)
                            .style('stroke', 'black')
                            .style('stroke-width', '2px')
                            .style('cursor', 'pointer');
                    })
                    .on('mouseout', function (event, d) {
                        d3.select('#tooltip')
                        .style('display', 'none');

                        d3.select(this)
                        .attr('r', 4)
                        .style('stroke-width', '1px')
                        .style('cursor', 'default');
                    })
                    .on('click', function (event, d) {
                        let zoom_factor = max_zoom;

                        g.transition(transition_time)
                            .attr('transform', `scale(${zoom_factor}) translate(${-(d.x - (width / (zoom_factor * 2)))}, ${-(d.y - (height / (zoom_factor * 2)))})`)

                        /*
                        d3.select('svg')
                            .transition(transition_time)
                            .call(zoom.scaleTo, zoom_factor)
                            .transition()
                            .call(zoom.translateTo, d.x, d.y)*/
                        
                        // To block normal zooming actions while the station is selected, the line below should be uncommented
                        allow_zoom = false;
                        event.stopPropagation();
                    });
            },
            function (update) {
                return update
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .attr('r', 4)
            },
            function (exit) {
                exit
                    .remove();
            }
        )
}


window.addEventListener('load', init)


