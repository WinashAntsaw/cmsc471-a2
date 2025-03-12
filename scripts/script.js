
// UTILITIES
function randColor() {
    output = "#";
    chars = 'abcdef';
    for (let i = 0; i < 6; i++) {
        num = Math.floor(Math.random() * 16);
        output += (num < 10)? `${num}` : chars[num - 10];
    }

    return output;
}


// Code for SVG Visualization
const margin = {top: 40, right: 40, bottom: 40, left: 60};
const width = 600 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;
const t = 1000;

// Global Variables
let allData = [];
let xVar = 'income', yVar = 'lifeExp', sizeVar = 'population', targetYear = 2000;
let xScale, yScale, sizeScale;
const continents = ['Africa', 'Asia', 'Oceania', 'Americas', 'Europe']
const colorScale = d3.scaleOrdinal(continents, d3.schemeSet2); // d3.schemeSet2 is a set of predefined colors. 
const prettyOptions = ['Income Per Person', 'Life Expectancy', 'GDP', 'Population', 'Child Deaths']
const options = ['income', 'lifeExp', 'gdp', 'population', 'childDeaths']

function convertOption(opt) {
    index = prettyOptions.indexOf(opt);
    return options[index];
}

function unconvertOption(opt) {
    index = options.indexOf(opt);
    console.log(opt)
    console.log(prettyOptions.indexOf(opt))
    return prettyOptions[index];
}


// Create SVG
const svg = d3.select('#vis')
.append('svg')
.attr('width', width + margin.left + margin.right)
.attr('height', height + margin.top + margin.bottom)
.append('g')
.attr('transform', `translate(${margin.left},${margin.top})`);



// Get Data
function init() {
    d3.csv(".\\data\\gapminder_subset.csv",
        function(d) {
            return {
                country: d.country,
                continent: d.continent,
                year: +d.year,
                lifeExp: +d.life_expectancy, 
                income: +d.income_per_person, 
                gdp: +d.gdp_per_capita, 
                childDeaths: +d.number_of_child_deaths,
                population: +d.population
            }
        }).then(data => {
            console.log(data);
            allData = data;
                     

            
            //placeholder for listeners
            setupSelector();
            updateAxes();
            updateVis();
            addLegend();
        });
}

// Update Functions
function setupSelector() {
    let slider = d3
        .sliderHorizontal()
        .min(d3.min(allData.map(d => +d.year))) // setup the range
        .max(d3.max(allData.map(d => +d.year))) // setup the range
        .step(1)
        .width(width)  // Widen the slider if needed
        .displayValue(false)
        .default(targetYear)
        .on('onchange', (val) => {
            d3.select('#value').text(val);
            targetYear = +val // Update the year
            updateVis() // Refresh the chart
        });

    d3.select('#slider')
        .append('svg')
        .attr('width', width)  // Adjust width if needed
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)')
        .call(slider);

    d3.selectAll('.variable')
        // loop over each dropdown button
        .each(function() {
             d3.select(this).selectAll('myOptions')
             .data(prettyOptions)
             .enter()
             .append('option')
             .text(d => d) // The displayed text
             .attr("value",d => d) // The actual value used in the code
        })
        .on("change", function (event) {
            let id = d3.select(this).property("id") // Logs which dropdown (e.g., xVariable)
            let prettyVal = d3.select(this).property("value") // Logs the selected value
            let val = convertOption(prettyVal)
            if (id == 'xVariable') {
                xVar = val
            }else if (id == 'yVariable') {
                yVar = val
            } else {
                sizeVar = val
            }

            updateAxes();
            updateVis();
        })

    
    d3.select('#xVariable').property('value', unconvertOption(xVar))
    d3.select('#yVariable').property('value', unconvertOption(yVar))
    d3.select('#sizeVariable').property('value', unconvertOption(sizeVar))


    updateAxes();
    updateVis();
}


function updateAxes(){
    //clear current axes
    svg.selectAll('.axis').remove()
    svg.selectAll('.labels').remove()

    // Draws the x-axis and y-axis
    yScale = d3.scaleLinear()
        .domain([0, d3.max(allData, d=>d[yVar])])
        .range([0, height]);
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,0)`)
        .call(yAxis);

    xScale = d3.scaleLinear()
        .domain([0, d3.max(allData, d=>d[xVar])])
        .range([0, width]);
    const xAxis = d3.axisBottom(xScale);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    
    // Adds ticks, labels, and makes sure everything lines up nicely
    // X-axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom)
        .attr("text-anchor", "middle")
        .text(unconvertOption(xVar)) // Displays the current x-axis variable
        .attr('class', 'labels')

    // Y-axis label (rotated)
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 40)
        .attr("text-anchor", "middle")
        .text(unconvertOption(yVar)) // Displays the current y-axis variable
        .attr('class', 'labels')
    


}

function updateVis(){
    // Draws (or updates) the bubbles
    sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(allData, d => d[sizeVar])]) // Largest bubble = largest data point 
        .range([5, 20]); // Feel free to tweak these values if you want bigger or smaller bubbles

    let currentData = allData.filter(d => d.year === targetYear);

    svg.selectAll('.points')
    .data(currentData, d => d.country)
    .join(
        function(enter){
            return enter
                .append('circle')
                .attr('class', 'points')
                .attr('cx', d => xScale(d[xVar]))
                .attr('cy', d => yScale(d[yVar]))
                .style('fill', d => colorScale(d.continent))
                .style('opacity', .5)
                .attr('r', 0)
                .on('mouseover', function (event, d) {
                    d3.select('#tooltip')
                    .style("display", 'block') // Make the tooltip visible
                    .html( // Change the html content of the <div> directly
                        `<strong>${d.country}</strong><br/>
                        Continent: ${d.continent}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");

                    d3.select(this) // Refers to the hovered circle
                    .style('stroke', 'black')
                    .style('stroke-width', '4px')
                })
                .on('mouseout', function (event, d) {
                    d3.select('#tooltip')
                    .style('display', 'none')

                    d3.select(this)
                    .style('stroke-width', '0px')
                    
                })
                .transition(t)
                .attr('r',  d => sizeScale(d[sizeVar]))
                
        },
        function(update){
            return update
            .transition(t)
            .attr('cx', d => xScale(d[xVar]))
            .attr('cy', d => yScale(d[yVar]))
            .attr('r',  d => sizeScale(d[sizeVar]))
        },
        function(exit){
            exit
            .transition(t)
            .attr('r', 0)
            .remove();
        }
    )
}

function addLegend(){
    // Adds a legend so users can decode colors
    let size = 10

    svg.selectAll('continentSquare')
        .data(continents)
        .enter()
        .append('rect')
        .attr('y', -margin.top/2)
        .attr('x', (d, i) => i * (size + 100) + 100)
        .attr('width', size)
        .attr('height', size)
        .style("fill", d => colorScale(d))
    
    svg.selectAll("continentName")
        .data(continents)
        .enter()
        .append("text")
        .attr("y", -margin.top/2 + size) // Align vertically with the square
        .attr("x", (d, i) => i * (size + 100) + 120)  
        .style("fill", d => colorScale(d))  // Match text color to the square
        .text(d => d) // The actual continent name
        .attr("text-anchor", "left")
        .style('font-size', '13px')
}

window.addEventListener('load', init);