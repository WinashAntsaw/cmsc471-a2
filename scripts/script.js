const test_coords = [{name: 'Newark', latitude: 39.6837, longitude: -75.7497}, {name: 'Olympia', latitude: 46.9733, longitude: -122.9033}, {name: 'ANNETTE ISLAND', latitude: 55.0389, longitude:-131.5786}, {name: 'Juneau', latitude: 58.3005, longitude:-134.4021}]       // Coordinates for some test coordinates For testing purposes, compare visually

// Functions and Variables for Data Processing
const valid_states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']

const data_options = [
    {name: 'Temperature', fullname: 'Average Temperature Across Observations (F)', csvname: 'TAVG'},
    {name: 'Snowfall', fullname: 'Snowfall Across Observations (inches)', csvname: 'SNOW'},
    {name: 'Precipitation', fullname: 'Precipitation (inches)', csvname: 'PRCP'},
    {name: 'Windspeed', fullname: 'Fastest 5-Second Wind Speed Across Daily Observations (miles/hour)', csvname: 'WSF5'}
    ];

let num_observations= [], data_var = data_options[0], min_observations = 25;


function get_data(datapoint) {
    return "Not implemented yet";
}

// SVG canvas variables
const width = 975;
const height = 610;

const svg = d3.select('#vis').append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");

const g = svg.append("g");

// Initialize zoom behavior
const transition_time = 1000;
let allow_zoom = true;
const  max_zoom = 8;
const min_zoom = 1;

const zoom = d3.zoom()
    .scaleExtent([min_zoom, max_zoom])
    .on("zoom", zoomed);

function zoomed(event) {
    const { transform } = event;
    g.attr("transform", transform);
    g.attr("stroke-width", 1 / transform.k);
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

// Main initialization function
async function init() {
    try {
        // Load geographic data (states boundaries)
        let us = await d3.json("./data/states-albers-10m.json");
        // Load weather data CSV
        let weather_data = await d3.csv("./data/weather.csv");
        
        // Filter weather data to include only valid US states
        weather_data = weather_data.filter(d => valid_states.includes(d.state));

        // Sort weather data by station
        weather_data = weather_data.sort((a, b) => a.station < b.station ? -1 : 1);

        let station_data = [];

        // Reduce weather_data by station
        function reducer(accum, curr) {
            let currWeather = {
                date: curr.date,
                TMIN: curr.TMIN,
                TMAX: curr.TMAX,
                TAVG: curr.TAVG,
                AWND: curr.AWND,
                WDF5: curr.WSF5,
                SNOW: curr.SNOW,
                SNWD: curr.SNWD,
                PRCP: curr.PRCP
            };

            if (accum.station == curr.station) {
                accum.weather.push(currWeather);
                return accum;
            } else {
                //console.log('Accumulator Weather Length ' + accum.weather.length);
                station_data.push(accum);
                let newAccum = {
                    station: curr.station,
                    latitude: curr.latitude,
                    longitude: curr.longitude,
                    elevation: curr.elevation,
                    state: curr.state,
                    weather: [currWeather]
                };
                return newAccum;
            }
        }        

        let initial = {
            station: weather_data[0].station,
            latitude: weather_data[0].latitude,
            longitude: weather_data[0].longitude,
            elevation: weather_data[0].elevation,
            state: weather_data[0].state,
            weather: []
        };

        let final_station = weather_data.reduce(reducer, initial);
        station_data.push(final_station);

        console.log("Old length: " + weather_data.length);
        console.log("New length: " + station_data.length);

        num_observations = station_data.map(d => d.weather.length);


        // Create visualization with map and weather data
        
        createVis(us, station_data);
        setupSelector(station_data);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}


// Create User Interaction Tools
function setupSelector(station_data){
    min_observations = Math.floor(d3.mean(num_observations));
    
    d3.select("#value").text(min_observations);
    let slider = d3
        .sliderHorizontal()
        .min(d3.min(num_observations))
        .max(d3.max(num_observations))
        .step(1)
        .width(width)
        .displayValue(false)
        .default(d3.mean(num_observations))
        .on('onchange', (val) => {
            //console.log(val);
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
            let thisname = d3.select(this).property('value');
            let option = data_options.find(d => d.name == thisname);
            data_var = option;
    });
    
    d3.select("#dataVar").property('value', data_var.name);
    
    
}


// Function to create the visualization (map and points)
function createVis(us, data) {    
    // Draw states on the map
    const states = g.append("g")
        .attr("fill", "#ddd")
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
    
    // Update visualization with weather station points
    updateVis(data);
}

// Helper function to convert data coordinates to screen coordinates
function coord_to_plot(datapoint) {
    let [x, y] = projection([datapoint.longitude, datapoint.latitude]);
    return {
        station: datapoint.station,
        state: datapoint.state,
        long: datapoint.longitude,
        lat: datapoint.latitude,
        x: x,
        y: y,
        weather: datapoint.weather,  // include station weather data
        data: get_data(datapoint)
    };
}

// Function to update the visualization with station points
function updateVis(weather_data) {
    const p_coords = weather_data.map(d => coord_to_plot(d));

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
                                   State: ${d.state}<br/>`)
                            .style("left", (event.pageX + 20) + "px")
                            .style("top", (event.pageY - 28) + "px");
                        
                        d3.select(this)
                          .attr('r', 7)
                          .style('stroke', 'black')
                          .style('stroke-width', '2px');
                    })
                    .on('mouseout', function (event, d) {
                        d3.select('#tooltip')
                            .style('display', 'none');

                        d3.select(this)
                          .attr('r', 4)
                          .style('stroke-width', '1px');
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
                        // Create line chart using "date" for the x-axis and "TAVG" for the y-axis
                        createLineChart(d.weather, 'date', data_var.csvname);
                    });
            },
            function (update) { return update; },
            function (exit) { exit.remove(); }
        );
}

// Function to create the line chart below the map
function createLineChart(weatherData, xVar, yVar) {
    // Clear any previous chart
    d3.select("#line-chart").html("");

    // Define margins and dimensions for the chart
    const margin = {top: 20, right: 30, bottom: 50, left: 50},
          chartWidth = 600 - margin.left - margin.right,
          chartHeight = 300 - margin.top - margin.bottom;

    // Append an SVG element to the #line-chart container
    const svgChart = d3.select("#line-chart")
        .append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse date strings into Date objects (adjust the format string as needed)
    const parseDate = d3.timeParse("%Y-%m-%d");
    weatherData.forEach(d => {
        d.parsedDate = parseDate(d.date);
        d.yValue = +d[yVar]; // Convert the y variable to a number
    });

    // Define scales for x (time) and y (linear)
    const xScale = d3.scaleTime()
        .domain(d3.extent(weatherData, d => d.parsedDate))
        .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(weatherData, d => d.yValue))
        .nice()
        .range([chartHeight, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    // Add the x-axis to the chart
    svgChart.append("g")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis);

    // Add the y-axis to the chart
    svgChart.append("g")
        .call(yAxis);

    // Create a line generator function
    const line = d3.line()
        .x(d => xScale(d.parsedDate))
        .y(d => yScale(d.yValue));

    // Append the line path to the SVG
    svgChart.append("path")
        .datum(weatherData)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Optionally, add axis labels
    svgChart.append("text")
        .attr("transform", `translate(${chartWidth/2}, ${chartHeight + margin.bottom - 5})`)
        .style("text-anchor", "middle")
        .text("Date");

    svgChart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (chartHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(yVar);
}

// Initialize the visualization when the window loads
window.addEventListener('load', init);
