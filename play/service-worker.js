(function() {
    'use strict';

    var version = 4;

    var staticCacheName = 'whotfisthis' + version;

    var filesToCache = [
        'index.html',
    ];

    self.addEventListener('install', function(event) {
        console.log('Installing new service worker...');

        self.skipWaiting();

        event.waitUntil(
            caches.open(staticCacheName).then(function(cache) {
                return cache.addAll(filesToCache);
            })
        );
    });
    

    self.addEventListener('activate', function(event) {
        console.log('Activating new service worker...');

        var cacheWhitelist = [staticCacheName];

        event.waitUntil(
            caches.keys().then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        if (cacheWhitelist.indexOf(cacheName) === -1) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        );
    });

  
    self.addEventListener('message', function handler (event) {
        var res = null;
        if(event.data.type == 'POST'){

            var data = event.data.data;
            var site = event.data.site;
            if(event.data.stringify){
                data = JSON.stringify(data);
            }
            var response;
            var request = new Request(site, {method: 'POST', body: data, credentials: 'include'});
            fetch(request)
                .then(response => {
                    event.ports[0].postMessage(response.ok);
                })
        }else if(event.data.type == 'GET'){
            var site = event.data.site;
            var request = new Request(site, {method: 'GET',credentials: 'include'});
            fetch(request)
                .then(r => {
                    response = r;
                    caches.open(staticCacheName).then(function(cache) {
                        return cache.put(request.url,response);
                    });
                    return response.clone();
                }).then(response =>{
                    return response.json();
                }).then(data =>{
                    event.ports[0].postMessage(data);
                    
                }).catch(error =>{
                    return caches.match(request.url).then(response =>{
                        return response.json();
                    }).then(data =>{
                        data.cached = true;
                        event.ports[0].postMessage(data);
                    })
                });
        }else if(event.data.type == 'DELETE'){
            var data = event.data.data;
            var site = event.data.site;
            if(event.data.stringify){
                data = JSON.stringify(data);
            }
            var request = new Request(site, {method: 'DELETE', body: data,credentials: 'include'});
            fetch(request)
                .then(response => {
                    event.ports[0].postMessage(response.ok);
                });
        }else{
            res = {
                success: false,
                error: true,
                message: "Invalid type " +event.data.type + ", Web Worker doesn´t support this type of request."
            }
        }
         // handle this using the replyHandler shown earlier
    });
    self.addEventListener('fetch', function(event) {
        
        if(event.request.mode === 'navigate'){
            event.respondWith(
                // Use ignoreSearch:true to ignore query string while matching urls
                // because we utilize ?utm_source=app_manifest in the app manifest.
                caches.match(event.request, {ignoreSearch:true}).then(function(response) {
                    if (response) {
                        console.log('Found ', event.request.url, ' in cache.');
                        return response;
                    }
    
                    console.log('Trying to get ', event.request.url, ' from network.');
    
                    if (event.request.url.indexOf('http://localhost:3000') > -1) {
                        // Remove etag header to guarantee downloading the resource.
                        var headers = new Headers(event.request.headers);
                        headers.delete('etag');
                        // Try to obtain image from network.
                        return fetch(event.request).catch(function (reason) {
                            console.log('Replaced ', event.request.url, ' with the offline image from cache.');
                            return caches.match('no_internet.html');
                        });
                    }
    
                    return fetch(event.request);
                })
            );
        }
    });
    

})();