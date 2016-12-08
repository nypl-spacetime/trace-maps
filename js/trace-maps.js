---
---
var API_URL = '{{ site.api-url }}'

var ORGANIZATION_ID = 'nypl'
var TASK_ID = 'trace-maps'

var collections = [
  {
    id: 'd2251ba0-7850-0134-7a11-00505686a51c'
  }
]
var items
var selectedItem

var elements = {
  error: document.getElementById('error'),
  oauth: document.getElementById('oauth')
}

var geojsonStyle = {
  color: '#ff7800',
  weight: 5,
  opacity: 0.65
}

var mapwarperLayer

var brickByBrick = BrickByBrick(API_URL, TASK_ID, collections.map(function (c) { return c.id }), elements)

function postSubmission() {
  var geojson = {
    type: 'FeatureCollection',
    features: drawnItems.getLayers().map(function (layer) {
      var feature = layer.toGeoJSON()
      feature.properties = Object.assign(feature.properties, layer._geojsonProperties)
      return feature
    })
  }

  if (selectedItem) {
    data = {
      geojson: geojson
    }

    brickByBrick.postSubmission(ORGANIZATION_ID, selectedItem.id, data)
      .then(function (results) {
        updateSaved(true)
      })
      .catch(function (err) {
        console.error(err.message)
      })
  }
}

function updateSaved (saved) {
  if (saved) {
    window.onbeforeunload = undefined
  } else {
    window.onbeforeunload = function () {
      return 'Are you sure want to leave the page, you have not saved your changes.'
    }
  }

  d3.select('#save-message')
    .classed('hidden', saved)

  d3.select('#save')
    .attr('disabled', saved ? true : null)

  d3.select('#items')
    .attr('disabled', saved ? null : true)
}

function getItems () {
  brickByBrick.getItems()
    .then(function (results) {
      items = results

      d3.select('#items').selectAll('option')
        .data(items).enter()
      .append('option')
        .attr('disabled', function (d) {
          if (!d.data.geometry) {
            return true
          }
        })
        .attr('value', function (d) {
          return d.id
        })
        .text(function (d, i) {
          return d.data.title
        })

      getItem(items[0].organization.id, items[0].id)
    })
    .catch(function (err) {
      console.error(err.message)
    })
}

function getItem (organizationId, id) {
  brickByBrick.getItem(organizationId, id)
    .then(function (item) {
      selectedItem = item

      drawnItems.clearLayers()
      d3.selectAll('.hidden')
        .classed('hidden', false)

      if (selectedItem.submission && selectedItem.submission.data) {
        var submissionData = selectedItem.submission.data

        if (submissionData.geojson && submissionData.geojson.features) {
          drawnItems.addData(submissionData.geojson)
        }
      }

      if (!mapwarperLayer) {
        mapwarperLayer = L.tileLayer(selectedItem.data.tileUrl).addTo(map)
      } else {
        mapwarperLayer.setUrl(selectedItem.data.tileUrl)
      }

      map.invalidateSize()

      if (selectedItem.data.geometry && selectedItem.data.geometry.coordinates && selectedItem.data.geometry.coordinates[0]) {
        var polygon = selectedItem.data.geometry.coordinates[0]
        map.fitBounds([
          [
            polygon[0][1],
            polygon[0][0]
          ],
          [
            polygon[2][1],
            polygon[2][0]
          ]
        ])
      }

      updateSaved(true)
    })
    .catch(function (err) {
      console.error(err.message)
    })
}

var map = L.map('map', {
  center: [40.8, -73.96],
  zoom: 14,
  minZoom: 9,
  maxZoom: 18
})

var baseLayer = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(map)

function bindPopup (layer) {
  var popup = document.createElement('div')

  var fields = selectedItem.collection.data.fields

  if (!layer._geojsonProperties) {
    layer._geojsonProperties = Object.assign({
      fields: {}
    }, layer.toGeoJSON().properties)
  }

  var field = d3.select(popup)
      .append('table')
      .append('tbody')
    .selectAll('tr').data(fields)
      .enter().append('tr')

  field.append('td')
    .text(function (d) {
      return d.name
    })

  field.append('td')
    .append('input')
      .attr('class', 'popup-input')
      .attr('type', 'number')
      .attr('value', function (d) {
        return layer._geojsonProperties.fields[d.name]
      })
      .on('input', function (d) {
        var value = parseInt(d3.select(this).property('value'))
        var oldValue = layer._geojsonProperties.fields[d.name]

        if (value !== oldValue) {
          layer._geojsonProperties.fields[d.name] = value
          updateSaved(false)
        }
      })

  layer.bindPopup(L.popup({
    closeButton: false,
    maxWidth: 500,
    maxHeight: 400,
    autoPanPadding: [5, 45],
    className: 'popup-feature'
  }, layer).setContent(popup))

  layer.on('popupopen', function (event) {
    var input = event.popup._container.querySelector('.popup-input')
    input.setSelectionRange(0, input.value.length)
    input.focus()
  })

  // layer.on('popupclose', function (event) {
  // })
}

var drawnItems = new L.geoJson(null, {
    style: geojsonStyle,
    onEachFeature: function (feature, layer) {
    bindPopup(layer, feature)
  }
})
map.addLayer(drawnItems)

map.addControl(new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,
    poly: {
      allowIntersection : false
    }
  },
  draw: {
    circle: false,
    marker: false,
    polyline: false,
    rectangle: false,
    polygon: {
      allowIntersection: false,
      shapeOptions: geojsonStyle
    }
  }
}))

map.on('draw:created', function (event) {
  var layer = event.layer
  drawnItems.addLayer(layer)

  bindPopup(layer)
  updateSaved(false)
})

map.on('draw:edited', function (event) {
  updateSaved(false)
})

map.on('draw:deleted', function (event) {
  updateSaved(false)
})

d3.select('#slider').on('input', function () {
  if (mapwarperLayer) {
    mapwarperLayer.setOpacity(this.value / 100)
  }
})

d3.select('#items').on('change', function () {
  var id = this.options[this.selectedIndex].value
  getItem(ORGANIZATION_ID, id)
})

d3.select('#save').on('click', function () {
  postSubmission()
})

getItems()

