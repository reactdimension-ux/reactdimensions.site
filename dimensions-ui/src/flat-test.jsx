// Dev-only harness: every Flat chart, static (animate off), for headless screenshots.
// /flat-test.html?only=FlatBarChart shows one. Add new charts to the list.
import { createRoot } from 'react-dom/client'
import FlatBarChart from './lib/FlatBarChart.jsx'
import FlatLollipopChart from './lib/FlatLollipopChart.jsx'
import FlatDotPlot from './lib/FlatDotPlot.jsx'
import FlatBulletChart from './lib/FlatBulletChart.jsx'
import FlatSlopeChart from './lib/FlatSlopeChart.jsx'
import FlatPopulationPyramid from './lib/FlatPopulationPyramid.jsx'
import FlatTreemap from './lib/FlatTreemap.jsx'
import FlatSunburst from './lib/FlatSunburst.jsx'
import FlatShareBar from './lib/FlatShareBar.jsx'
import FlatWordCloud from './lib/FlatWordCloud.jsx'
import FlatDotMatrix from './lib/FlatDotMatrix.jsx'
import FlatPictogram from './lib/FlatPictogram.jsx'
import FlatProgressBars from './lib/FlatProgressBars.jsx'
import FlatPercentRings from './lib/FlatPercentRings.jsx'
import FlatDonutChart from './lib/FlatDonutChart.jsx'
import FlatLineChart from './lib/FlatLineChart.jsx'
import FlatPeaksChart from './lib/FlatPeaksChart.jsx'
import FlatRadarChart from './lib/FlatRadarChart.jsx'

import FlatPinChart from './lib/FlatPinChart.jsx'
import FlatPyramidChart from './lib/FlatPyramidChart.jsx'
import FlatStepTimeline from './lib/FlatStepTimeline.jsx'

import FlatGanttChart from './lib/FlatGanttChart.jsx'
import FlatStreamgraph from './lib/FlatStreamgraph.jsx'
import FlatWaterfallChart from './lib/FlatWaterfallChart.jsx'
import FlatParetoChart from './lib/FlatParetoChart.jsx'

import FlatGauge from './lib/FlatGauge.jsx'
import FlatKpiTiles from './lib/FlatKpiTiles.jsx'
import FlatHeatmap from './lib/FlatHeatmap.jsx'
import FlatCorrelationMatrix from './lib/FlatCorrelationMatrix.jsx'

import FlatHistogram from './lib/FlatHistogram.jsx'
import FlatBoxPlot from './lib/FlatBoxPlot.jsx'
import FlatViolinPlot from './lib/FlatViolinPlot.jsx'
import FlatRidgelinePlot from './lib/FlatRidgelinePlot.jsx'
import FlatStripPlot from './lib/FlatStripPlot.jsx'
import FlatScatterPlot from './lib/FlatScatterPlot.jsx'
import FlatBubbleChart from './lib/FlatBubbleChart.jsx'
import FlatHexbinPlot from './lib/FlatHexbinPlot.jsx'
import FlatParallelCoordinates from './lib/FlatParallelCoordinates.jsx'

import FlatAreaChart from './lib/FlatAreaChart.jsx'
import FlatStepChart from './lib/FlatStepChart.jsx'
import FlatSparklines from './lib/FlatSparklines.jsx'
import FlatCandlestickChart from './lib/FlatCandlestickChart.jsx'
import FlatSankeyDiagram from './lib/FlatSankeyDiagram.jsx'
import FlatAlluvialDiagram from './lib/FlatAlluvialDiagram.jsx'
import FlatChordDiagram from './lib/FlatChordDiagram.jsx'
import FlatNetworkGraph from './lib/FlatNetworkGraph.jsx'
import FlatTreeChart from './lib/FlatTreeChart.jsx'

const ALL = [
  ['FlatSankeyDiagram', FlatSankeyDiagram, {}],
  ['FlatAlluvialDiagram', FlatAlluvialDiagram, {}],
  ['FlatChordDiagram', FlatChordDiagram, {}],
  ['FlatNetworkGraph', FlatNetworkGraph, {}],
  ['FlatTreeChart', FlatTreeChart, {}],
  ['FlatLollipopChart', FlatLollipopChart, {}],
  ['FlatDotPlot', FlatDotPlot, {}],
  ['FlatBulletChart', FlatBulletChart, {}],
  ['FlatSlopeChart', FlatSlopeChart, {}],
  ['FlatPopulationPyramid', FlatPopulationPyramid, {}],
  ['FlatAreaChart', FlatAreaChart, {}],
  ['FlatStepChart', FlatStepChart, {}],
  ['FlatSparklines', FlatSparklines, {}],
  ['FlatCandlestickChart', FlatCandlestickChart, {}],
  ['FlatGauge', FlatGauge, {}],
  ['FlatKpiTiles', FlatKpiTiles, {}],
  ['FlatHeatmap', FlatHeatmap, {}],
  ['FlatCorrelationMatrix', FlatCorrelationMatrix, {}],
  ['FlatTreemap', FlatTreemap, {}],
  ['FlatSunburst', FlatSunburst, {}],
  ['FlatShareBar', FlatShareBar, {}],
  ['FlatWordCloud', FlatWordCloud, {}],
  ['FlatHistogram', FlatHistogram, {}],
  ['FlatBoxPlot', FlatBoxPlot, {}],
  ['FlatViolinPlot', FlatViolinPlot, {}],
  ['FlatRidgelinePlot', FlatRidgelinePlot, {}],
  ['FlatStripPlot', FlatStripPlot, {}],
  ['FlatScatterPlot', FlatScatterPlot, {}],
  ['FlatBubbleChart', FlatBubbleChart, {}],
  ['FlatHexbinPlot', FlatHexbinPlot, {}],
  ['FlatParallelCoordinates', FlatParallelCoordinates, {}],
  ['FlatGanttChart', FlatGanttChart, {}],
  ['FlatStreamgraph', FlatStreamgraph, {}],
  ['FlatWaterfallChart', FlatWaterfallChart, {}],
  ['FlatParetoChart', FlatParetoChart, {}],
  ['FlatPinChart', FlatPinChart, {}],
  ['FlatPinChart', FlatPinChart, { variant: 'badges', height: 170, title: 'Badges', data: 'North:42, East:58, South:31, West:77, Central:64, Online:90', suffix: 'k', prefix: '$' }],
  ['FlatPinChart', FlatPinChart, { data: 'Mon:5, Tue:12, Wed:8, Thu:20, Fri:16, Sat:3, Sun:9', pinSize: 44, stripes: false, colorByPin: false, suffix: '', title: 'One colour' }],
  ['FlatPyramidChart', FlatPyramidChart, {}],
  ['FlatPyramidChart', FlatPyramidChart, { mode: 'value', title: 'Value mode', data: 'Leaders:4, Managers:12, Leads:24, Staff:60' }],
  ['FlatPyramidChart', FlatPyramidChart, { inverted: true, title: 'Funnel', data: 'Visitors:100, Leads:62, Trials:35, Customers:18, Fans:7', facet: false }],
  ['FlatStepTimeline', FlatStepTimeline, {}],
  ['FlatStepTimeline', FlatStepTimeline, { perRow: 4, dashed: false, title: 'Four per row', data: 'Kickoff meeting:Jan 4, Discovery workshops:Feb, Prototype:Mar, User testing round:Apr, Beta:May, Launch:Jun, Review:Jul' }],
  ['FlatStepTimeline', FlatStepTimeline, { perRow: 5, data: 'One, Two, Three, Four, Five', pathWidth: 10, nodeSize: 36, title: 'Single row' }],
  ['FlatBarChart', FlatBarChart, {}],
  ['FlatBarChart', FlatBarChart, { orientation: 'horizontal', title: 'Horizontal' }],
  ['FlatDotMatrix', FlatDotMatrix, {}],
  ['FlatDotMatrix', FlatDotMatrix, { shape: 'rounded-square', data: 'Agree:64', total: 50, columns: 10, title: 'Single share', width: 380 }],
  ['FlatPictogram', FlatPictogram, {}],
  ['FlatPictogram', FlatPictogram, { icon: 'heart', data: 'Loved it:8, Liked it:1', total: 20, columns: 10, title: 'Hearts', width: 380 }],
  ['FlatPictogram', FlatPictogram, { icon: 'star', data: 'Five stars:6', columns: 10, showHeadline: true, title: 'Stars' }],
  ['FlatPictogram', FlatPictogram, { icon: 'drop', data: 'Saved:3, Used:5', columns: 10, title: 'Drops' }],
  ['FlatProgressBars', FlatProgressBars, {}],
  ['FlatProgressBars', FlatProgressBars, { variant: 'stacked', title: 'Stacked' }],
  ['FlatProgressBars', FlatProgressBars, { variant: 'inline', title: 'Inline', roundness: 0.4, stripes: false }],
  ['FlatPercentRings', FlatPercentRings, {}],
  ['FlatPercentRings', FlatPercentRings, { title: 'Animated, 3 columns', columns: 3, thickness: 20, roundCaps: false, innerFill: false, startAngle: -90, animate: true, duration: 1, data: 'Done:100, Doing:42.5, Todo:7', decimals: 1 }],
  ['FlatDonutChart', FlatDonutChart, {}],
  ['FlatDonutChart', FlatDonutChart, { title: 'Staggered, animated', staggered: true, explode: 8, animate: true, duration: 1, labels: 'inside', innerRadius: 0.45, data: 'Rent:1200, Food:450, Travel:300, Fun:220, Bills:180, Misc:90', prefix: '$' }],
  ['FlatLineChart', FlatLineChart, {}],
  ['FlatLineChart', FlatLineChart, { title: 'Smooth, values', curve: 'smooth', showValues: true, data: 'Q1:120, Q2:180, Q3:150, Q4:240', series: 'Revenue', prefix: '$', suffix: 'k' }],
  ['FlatLineChart', FlatLineChart, { title: 'Three series, falling', growthArrow: true, showArea: false, data: 'Mon:40|30|20, Tue:35|32|26, Wed:30|28|30, Thu:22|30|33, Fri:12|24|38', series: 'Alpha, Beta, Gamma', markerSize: 5 }],
  ['FlatPeaksChart', FlatPeaksChart, {}],
  ['FlatPeaksChart', FlatPeaksChart, { title: 'No facets, wide overlap', facet: false, overlap: 0.75, opacity: 0.7, suffix: '%', data: 'North:34, East:58, South:81, West:46, Central:67, Coast:29, Hills:52' }],
  ['FlatRadarChart', FlatRadarChart, {}],
  ['FlatRadarChart', FlatRadarChart, { title: 'Single series, plain web', bandedRings: false, levels: 4, data: 'Strength:7, Agility:9, Wisdom:5, Charisma:6, Luck:8', series: 'Hero', fillOpacity: 0.35 }],
  ['FlatDonutChart', FlatDonutChart, { title: 'Many small slices', staggered: true, showLegend: false, data: 'A long label:60, B:12, C:9, D:7, E:5, F:4, G:3' }],
]
const q = new URLSearchParams(location.search)
const only = q.get('only')
// ?only=Name&props=[{...},{...}] renders one card per props object instead of the listed variants
const extra = q.get('props') ? [].concat(JSON.parse(q.get('props'))) : null
const rows = ALL.filter(([n]) => !only || n === only)
const list = extra && rows.length ? extra.map((p) => [rows[0][0], rows[0][1], p]) : rows
createRoot(document.getElementById('root')).render(
  <>{list.map(([n, C, p], i) => <C key={i} animate={false} width={560} {...p} />)}</>,
)
