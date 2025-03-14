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

    let data = datapoint.weather.filter(d => d[data_var.csvname] != '');
    data = data.map(d => +d[data_var.csvname])
    return d3.mean(data);
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
let allow_zoom = true;
const  max_zoom = 8;
const min_zoom = 1;

const zoom = d3.zoom()
    .scaleExtent([min_zoom, max_zoom])
    .on("zoom", zoomed);




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
                WDF5: curr.WDF5,
                WSF5: curr.WSF5,
                SNOW: curr.SNOW,
                SNWD: curr.SNWD,
                PRCP: curr.PRCP
            }

            if (accum.station == curr.station) {
                accum.weather.push(currWeather);
                return accum;
            } else {
                //console.log('Accumulator Weather Length ' + accum.weather.length);
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

        num_observations = station_data.map(d => d.weather.length);



        s = station_data.find(d => d.station == 'Port Graham');
        console.log('Hello' + s.weather.map(d => d.SNOW));
        // Create visualization with map and weather data
        
        createVis(us, station_data);
        setupSelector(station_data);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}


function setupSelector(station_data){
    min_observations = Math.floor(d3.mean(num_observations));
    
    d3.select("#value").text(min_observations);
    let slider = d3
        .sliderHorizontal()
        .min(d3.min(num_observations))
        .max(d3.max(num_observations))
        .step(1)
        .width(width-240)
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
        
    
    d3.select("#dataVar").property('value', data_var.name)
        .on('change', function (event) {
            let thisname = d3.select(this).property('value');
            let option = data_options.find(d => d.name == thisname);
            data_var = option;
            updateVis(station_data)
        });
    
    
}


// Function to create the visualization (map and points)
function createVis(us, data) {    

    const states = g.append("g")
        .attr("fill", "#888")
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
            weather: datapoint.weather,
            data: get_data(datapoint)
        }
    }

    p_coords = weather_data.filter(d => (d.weather.length >= min_observations));
    console.log(data_var.csvname)
    p_coords = p_coords.filter(d => !(d.weather.every(x => x[data_var.csvname] == '')))

    p_coords = p_coords.map(coord_to_plot);

    data  = p_coords.map(d => d.data);
    min = d3.min(data);
    max = d3.max(data);

    colorScheme = (data_var.csvname == 'TAVG')? d3.interpolateRdBu : d3.interpolateBlues

    //colorDomain =  (data_var.csvname == 'TAVG')? [max, min] : [min, max];
    colorDomain = [max, min];

    let color = d3.scaleSequential(colorDomain, colorScheme)
    


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
                    .attr('fill', d => color(d.data))
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
                            .style("top", (event.pageY - 28) + "px")
                            .style('background-color', color(d.data));
                        
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

                        //Change this so that PRCP can be replaced with any value the user chooses from the dropdown
                        
                        /*
                        d3.select('svg')
                            .transition(transition_time)
                            .call(zoom.scaleTo, zoom_factor)
                            .transition()
                            .call(zoom.translateTo, d.x, d.y)*/
                        
                        // To block normal zooming actions while the station is selected, the line below should be uncommented
                        allow_zoom = false;
                        
                        // Create line chart using "date" for the x-axis and "TAVG" for the y-axis
                        createChart(d.weather, 'date', data_var);
                        event.stopPropagation();
                    });
            },
            function (update) {
                return update
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .attr('r', 4)
                    .style('fill', d => color(d.data))
                    .on('mouseover', function (event, d) {
                        d3.select('#tooltip')
                            .style('display', 'block')
                            .html(`<strong>${d.station}</strong><br/>
                                    ${Math.abs(d.lat)}&deg${(d.lat > 0)? 'N' : 'S'}, ${Math.abs(d.long)}&deg${(d.long > 0)? 'E':'W'}<br/>
                                    State: ${d.state}<br/>
                                    `)
                            .style("left", (event.pageX + 20) + "px")
                            .style("top", (event.pageY - 28) + "px")
                            .style('background-color', color(d.data));
                        
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

                        //Change this so that PRCP can be replaced with any value the user chooses from the dropdown
                        
                        /*
                        d3.select('svg')
                            .transition(transition_time)
                            .call(zoom.scaleTo, zoom_factor)
                            .transition()
                            .call(zoom.translateTo, d.x, d.y)*/
                        
                        // To block normal zooming actions while the station is selected, the line below should be uncommented
                        allow_zoom = false;
                        
                        // Create line chart using "date" for the x-axis and "TAVG" for the y-axis
                        createChart(d.weather, 'date', data_var);
                        event.stopPropagation();
                    });
            },
            function (exit) {
                exit
                    .remove();
            }
        )

        addLegend(color, colorDomain[0], colorDomain[1]);
}

function addLegend(scale, left, right) {
    const legendHeight = 60;
    const barHeight = legendHeight / 2;
    d3.select('#legend').remove();

    const legend_svg = d3.select("#vis").append('svg').attr('id', 'legend')
        .attr("viewBox", [0, 0, width, legendHeight])
        .attr("width", width)
        .attr("height", legendHeight)
        .attr('margin', 0)
        .style('border', '0px');

    let defs = legend_svg.append('defs');

    let grad = defs.append('linearGradient').attr('id', 'linear-gradient')
    
    if (data_var.csvname == 'TAVG') {
        grad = grad.attr('x1', '100%').attr('x2', '0%');
    }
    

    grad.selectAll('stop')
        .data(scale.ticks().map((t, i, n) => ({offset: `${100*i/n.length}%`, color: scale(t)})))
        .enter().append('stop')
        .attr('offset', d=> d.offset)
        .attr('stop-color', d => d.color)

    legend_svg.append('g')
        .attr('transform', `translate(0, 0)`)
        .append('rect')
        .attr('width', width)
        .attr('height', barHeight)
        .style('fill', 'url(#linear-gradient)')
    
    const axisScale = d3.scaleLinear()
        .domain([left, right])
        .range([width, 0])

    const xAxis = d3.axisBottom(axisScale)
    legend_svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${legendHeight/2})`)
        .call(xAxis);

    legend_svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', width / 2)
        .attr('y', legendHeight)
        .attr('text-anchor', 'middle')
        .text(data_var.fullname)
}

// Function to create a scatter plot (points) below the map
function createChart(weatherData, xVar, option) {
    yVar = option.csvname;
    // Clear any previous chart
    d3.select("#line-chart").select('svg').remove();

    const margin = {top: 20, right: 30, bottom: 50, left: 50},
          chartWidth = 600 - margin.left - margin.right,
          chartHeight = 300 - margin.top - margin.bottom;

    const svgChart = d3.select("#line-chart")
        .append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y%m%d");
    weatherData.forEach(d => {
        d.parsedDate = parseDate(d.date);
        d.yValue = +d[yVar]; // convert the y variable to a number
        if (Number.isNaN(d.yValue)) {
            console.log("Can't convert to number: " + d[yVar])
        }
    });

    const xScale = d3.scaleTime()
        .domain(d3.extent(weatherData, d => d.parsedDate))
        .range([0, chartWidth]);

    console.log(weatherData.map(d => d.yValue));
    
    const yScale = d3.scaleLinear()
        .domain(d3.extent(weatherData, d => d.yValue))
        .nice()
        .range([chartHeight, 0]);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    svgChart.append("g")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis);

    svgChart.append("g")
        .call(yAxis);

    // Plot each weather observation as a point
    svgChart.selectAll("circle")
        .data(weatherData)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.parsedDate))
        .attr("cy", d => yScale(d.yValue))
        .attr("r", 3)
        .attr("fill", "steelblue").on('mouseover', function (event, d) {
            d3.select('#tooltip')
                .style('display', 'block')
                .html(`
                        ${d.parsedDate}<br/>
                        ${yVar}: ${d.yValue}<br/>
                        `)
                .style("left", (event.pageX + 20) + "px")
                .style("top", (event.pageY - 28) + "px");
            
            d3.select(this)
                .attr('r', 5)
                .style('stroke', 'black')
                .style('stroke-width', '2px')
                .style('cursor', 'pointer');
        })
        .on('mouseout', function (event, d) {
            d3.select('#tooltip')
            .style('display', 'none');

            d3.select(this)
            .attr('r', 3)
            .style('stroke-width', '0px')
            .style('cursor', 'default');
        });

    svgChart.append("text")
        .attr("transform", `translate(${chartWidth/2}, ${chartHeight + margin.bottom - 5})`)
        .style("text-anchor", "middle")
        .text("Date");

    console.log('YVar is '  + yVar);
    svgChart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (chartHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(option.name);

    svgChart.append('text')
        .attr('class', 'chart-title')
        .attr('x', chartWidth / 2)
        .attr('y', margin.top - 20)
        .attr('text-anchor', 'middle')
        .text(option.fullname)
}

window.addEventListener('load', init)

