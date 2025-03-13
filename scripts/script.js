const test_coords = [{name: 'Newark', latitude: 39.6837, longitude: -75.7497}, {name: 'Olympia', latitude: 46.9733, longitude: -122.9033}, {name: 'ANNETTE ISLAND', latitude: 55.0389, longitude:-131.5786}, {name: 'Juneau', latitude: 58.3005, longitude:-134.4021}]       // Coordinates for some test coordinates For testing purposes, compare visually

// Functions and Variables for Data Processing
const valid_states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']

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

const zoom = d3.zoom()
    .scaleExtent([1, 8])
    //.translateExtent([[0, 0], [width, height]])
    .on("zoom", zoomed);


function zoomed(event) {
    const {transform} = event;
    g.attr("transform", transform);
    g.attr("stroke-width", 1 / transform.k);
}

svg.call(zoom);

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

                newAccum = {
                    station: curr.station,
                    latitude: curr.latitude,
                    longitude: curr.longitude,
                    elevation: curr.elevation,
                    state: curr.state,
                    weather: [currWeather]
                }

                return newAccum
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

    } catch (error) {
        console.error('Error loading data:', error);
    }
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
        let [x, y] = projection([datapoint.longitude, datapoint.latitude]);

        return {
            station: datapoint.station,
            state: datapoint.state,
            long: datapoint.longitude,
            lat: datapoint.latitude,
            x: x,
            y: y,
            data: get_data(datapoint)
        }
    }

    p_coords = weather_data.map(d => coord_to_plot(d))


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
                    })
                    .on('mouseout', function (event, d) {
                        d3.select('#tooltip')
                        .style('display', 'none');

                        d3.select(this)
                        .attr('r', 4)
                        .style('stroke-width', '1px');
                    });
            },
            function (update) {
                return update
            },
            function (exit) {
                exit
                    .remove();
            }
        )
}


window.addEventListener('load', init)


