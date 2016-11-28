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

var mapwarperLayer

var brickByBrick = BrickByBrick(API_URL, TASK_ID, collections.map(function (c) { return c.id }), elements)

function postSubmission() {
  var geojson = drawnItems.toGeoJSON()

  // geojson.features.forEach(function (feature) {
  //   feature.properties = {
  //     fields: {
  //       number: 4
  //     }
  //   }
  // })

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
}

function getItems () {
  brickByBrick.getItems()
    .then(function (results) {
      items = results

      d3.select('#items').selectAll('option')
        .data(items).enter()
      .append('option')
        .attr('value', function (d) {
          return d.id
        })
        .text(function (d, i) {
          return 'Map ' + (i + 1) //+ ' - ' + d.data.title
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

      d3.selectAll('.hidden')
        .classed('hidden', false)

      if (selectedItem.submission && selectedItem.submission.data) {
        var submissionData = selectedItem.submission.data

        if (submissionData.geojson) {
          drawnItems.addData(submissionData.geojson)
        }
      }

      if (!mapwarperLayer) {
        mapwarperLayer = L.tileLayer(selectedItem.data.tileUrl).addTo(map)
      } else {
        mapwarperLayer.setTileUrl(selectedItem.data.tileUrl)
      }

      map.invalidateSize()
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
  var properties = layer.toGeoJSON().properties

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
      .attr('type', 'number')
      .attr('value', function (d) {
        if (properties && properties.fields) {
          return properties.fields[d.name]
        }
      })
      .on('input', function (d) {
        if (!layer.feature.properties.fields) {
          layer.feature.properties.fields = {}
        }

        var value = parseInt(d3.select(this).property('value'))
        var oldValue = layer.feature.properties.fields[d.name]

        if (value !== oldValue) {
          layer.feature.properties.fields[d.name] = value
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

  // layer.on('popupclose', function (e) {
  // })
}

var drawnItems = new L.geoJson(null, {
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
      showArea:true
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

d3.select('#slider').on('input', function (event) {
  if (mapwarperLayer) {
    mapwarperLayer.setOpacity(this.value / 100)
  }
})

d3.select('#save').on('click', function (event) {
  postSubmission()
})

getItems()

