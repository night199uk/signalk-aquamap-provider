import { ResourceProvider, Route } from '@signalk/server-api'
import { Request, Response, Application } from 'express'
import {
  Plugin,
  PluginServerApp,
  ResourceProviderRegistry
} from '@signalk/server-api'
import { DOMParser } from '@xmldom/xmldom'
import { gpx } from '@tmcw/togeojson'

interface Config {
  username: string
}

interface AquaMapProviderApp
  extends PluginServerApp,
    ResourceProviderRegistry,
    Application {
}
//const CONFIG_UISCHEMA = {
//    standard: {
//        routes: {
//            'ui:widget': 'checkbox',
//            'ui:title': ' ',
//            'ui:help': '/signalk/v2/api/resources/routes'
//        }
//    }
//}
module.exports = (app: AquaMapProviderApp) => {
    let props: Config = {
        username: "",
    }

    const CONFIG_SCHEMA = {
        title: 'Aqua Map Routes for SignalK',
        type: 'object',
        properties: {
            username: {
                type: 'string',
                title: 'Aqua Map Username',
                description: `Aqua Maps Username`,
            }
        }
    }
    const CONFIG_UISCHEMA = {}
    const plugin: Plugin = {
        id: 'signalk-aquamap-provider',
        name: 'Aqua Map Routes Provider',
        schema: () => CONFIG_SCHEMA,
        uiSchema: () => CONFIG_UISCHEMA,
        start: function(settings: any) {
            console.log("** loaded settings: ", settings)
            props = { ... settings }
            try {
                app.registerResourceProvider(routesProvider)
            }
            catch (error) {
                // handle error
    	        console.log("error registering aqua maps provider" + error);
            }
        },
        stop: function() {
        }
    }

    const routesProvider: ResourceProvider = {
        type: 'routes',
        methods: {
            listResources: (params: {
              [key: string]: number | string | object | null
            }) => {
                var url = new URL('https://www.globalterramaps.com/lib/elFinder-2.1.40/php/connector.minimal.php')
                var getparams = {
                    username: props.username,
                    cmd: 'open',
                    target: 'l1_Lw',
                    init: '1',
                    tree: '1',
                }
                url.search = new URLSearchParams(getparams).toString();

                return fetch(url)
                    .then((response) => response.json())
	            .then(async (responseJson) => {
                        var gpxjson: {[key: string]: number|string|object|null} = {}
			var gpxfiles = responseJson.files.filter((file: {[key: string]: number|string|object|null}) => file.mime == 'application/gpx+xml')
			for (const file of gpxfiles) {
                            // console.log("file: %o", file)
                            var url = new URL('https://www.globalterramaps.com/GetTrackFile.php')
                            var postparams = {
                                user: props.username,
                                link: `userareas/${props.username}/${props.username}-root/${file['name']}`
                            }
                            var body = new URLSearchParams(postparams).toString();
                            var headers = new Headers({
                                'Content-Type': 'application/x-www-form-urlencoded'
                            })
                            const response = await fetch(url, 
                            {
                                method: "POST", 
                                headers: headers,
                                body: body
                            }).then((response) => response.text())
                            const doc = new DOMParser().parseFromString(response, 'text/xml')
                            const geojson = gpx(doc)
        
                            var route = { name: "", description: "", feature: { geometry: { } } }
                            if (
			        geojson &&
                                geojson.type === 'FeatureCollection' && 
                                Array.isArray(geojson.features)
                            ) {
                                route.name = geojson.features[0].properties?.name
                                route.description = geojson.features[0].properties?.desc
                                route.feature = geojson.features[0]
                            }
                            // console.log("route: %o", route)
                            gpxjson[file['name']] = route
                        }
                        // console.log("gpxjson: %o", gpxjson)
                        return gpxjson 
                     })
            },
            getResource: (id, property?) => {
	        // console.log("getResource: %o", id);
                var url = new URL('https://www.globalterramaps.com/GetTrackFile.php')
                var postparams = {
                    user: props.username,
                    link: `userareas/${props.username}/${props.username}-root/${id}`
                }
                var body = new URLSearchParams(postparams).toString();
                var headers = new Headers({
                            'Content-Type': 'application/x-www-form-urlencoded'
                        })
                return fetch(url,
                    {
                        method: "POST",
                        headers: headers,
                        body: body
                    }).then((response) => response.text())
		      .then((response) => {
                        const doc = new DOMParser().parseFromString(response, 'text/xml')
                        const geojson = gpx(doc)
                        var route = { name: "", description: "", feature: { geometry: { } } }
                        if (
                            geojson.type === 'FeatureCollection' &&
                            Array.isArray(geojson.features)
                        ) {
                            route.name = geojson.features[0].properties?.name
                            route.description = geojson.features[0].properties?.desc
                            route.feature = geojson.features[0]
                        }
                        // console.log("route: %o", route)
        		return route
		    })
            },
            setResource: (id, value )=> { 
                return new Promise((resolveInner) => {
                    return {test: ""}
                })
            },
            deleteResource: (id) => { 
                return new Promise((resolveInner) => {
                    return {test: ""}
                })
            }
	}
    }


    return plugin
};
