if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (v) {
        return this.indexOf(v) === 0;
    }
}
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (v) {
        return this.substr(this.length - v.length) === v;
    }
}
if (!Array.prototype.includes) {
    Array.prototype.includes = function (v) {
        return this.indexOf(v) !== -1;
    }
}
if(!Object.values){
    Object.values = function (obj) {
        return Object.keys(obj).map(function(e) {
            return obj[e]
        })
    }
}
function sortBy(values, orders){
    if(!values || !values.length){
        return [];
    }
    function genSorter(field, flag) {
        function sort(a, b){
            return a[field] > b[field] ? flag : (a[field] < b[field] ? -flag : 0);
        }
        return sort;
    }
    orders.forEach(function (order){
        let desc = order[0] === '-';
        let field = desc ? order.substr(1) : order;
        values.sort(genSorter(field, desc ? -1 : 1));
    })
    return values;
}
function validURL(url) {
    if (!url) {
        return null;
    }
    if (typeof url !== 'string') {
        return null;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            if(IE){
                return {
                    url: url,
                    host: url.split('//')[1].split('/')[0]
                }
            }
            let urlObj = new URL(url);
            return {
                url: url,
                host: urlObj.host
            }
        } catch (e) {
            // invalid url
            return null;
        }
    } else if (!url.startsWith('/')) {
        return null
    }
    return {
        url: url,
        host: null
    }
}
const IE = !!window.MSInputMethodContext && !!document.documentMode;
// analyze host of the url, if a url is slow or error, probably the entire host is unavailable
// notify other pending loader to downgrade this host

function ResourceLoader(options) {
    let validUrls = [];
    if (options.urls && Array.isArray(options.urls) && options.urls.length) {
        (options.urls || []).forEach(function (url){
            if (!url) {
                return
            }
            let urlObject
            if (typeof url === 'object') {
                urlObject = validURL(url.url);
                if (urlObject) {
                    urlObject.timeout = url.timeout || options.timeout;
                    urlObject.responseTimeout = url.responseTimeout || options.responseTimeout;
                }
            } else {
                urlObject = validURL(url);
                if (urlObject) {
                    urlObject.timeout = options.timeout;
                    urlObject.responseTimeout = options.responseTimeout;
                }
            }
            if (!urlObject) {
                return;
            }
            validUrls.push(urlObject);
        })
    }
    return {
        urls: validUrls,
        name: options.name,
        doLoad: options.load,
        dependency: options.dependency,
        concurrency: options.concurrency,
        timeout: options.timeout,
        responseTimeout: options.responseTimeout,
        userCallback: options.callback,
        reporter: options.reporter,
        priorityGetter: options.priorityGetter,
        random: options.random,
        loadingController: {},
        // url: abortController, use object to enable concurrency safe
        errorUrls: [],
        finished: false,
        applied: false,
        finishedUrl: null,
        data: null,
        link: options.link,
        finishURL: function(url, error) {
            let controller = this.loadingController[url];
            if (!controller) {
                // already finish
                return
            }
            delete this.loadingController[url];
            if (error) {
                this.errorUrls.push(url);
            } else {
                // if successfully finish, abort all pending fetch urls
                Object.values(this.loadingController).forEach(function (controller){
                    try {
                        controller.abort()
                    } catch (e) {
                        // ignore abort error
                    }
                })
                this.loadingController = {};    // reset
                this.finishedUrl = url;
                this.finished = true;
            }
            if (this.reporter) {
                this.reporter(this, url, error);
            }
            if (this.finished) {
                return;
            }
            // check concurrency
            if (!this.concurrency || Object.keys(this.loadingController).length < this.concurrency) {
                this.load();    // load again
            }
        },
        ieFetchURL: function(url, timeout, responseTimeout) {
            let xhr = new XMLHttpRequest();
            let _this = this;
            xhr.onabort = function (){
                _this.errorCallback(url)
            };
            xhr.ontimeout = function (){
                _this.errorCallback(url)
            };
            xhr.onerror = function (){
                _this.errorCallback(url)
            };
            xhr.onload = function (){
                if (xhr.readyState === 4) {
                    if (xhr.status >= 400 || xhr.status < 200) {
                        _this.errorCallback(url)
                    } else {
                        _this.callback(url, xhr.responseText)
                    }
                }
            };
            xhr.open("GET", url, true);
            xhr.timeout = timeout;      // set after open
            if (responseTimeout) {
                setTimeout(function (){
                    xhr.abort();
                }, responseTimeout)
            }
            xhr.send(null);
            return xhr;     // both xhr and AbortController has provided abort() method
        },
        fetchURL: function(url, timeout, responseTimeout) {
            if (IE) {
                return this.ieFetchURL(url, timeout, responseTimeout);
            }
            // response timeout means the download
            const controller = new AbortController()
            const requestTimeoutController = timeout ? setTimeout(function () {
                controller.abort();
            }, timeout) : null;
            const responseTimeoutController = responseTimeout ? setTimeout(function () {
                controller.abort();
            }, responseTimeout) : null;

            let _this = this;
            fetch(url, {signal: timeout ? controller.signal : null}).then(function (response){
                clearTimeout(requestTimeoutController);
                if (response.status >= 400 || response.status < 200) {
                    return _this.errorCallback(url, response)
                }
                response.text().then(function (data) {
                    clearTimeout(responseTimeoutController);
                    return _this.callback(url, data)
                }).catch(function(e) {
                    return _this.errorCallback(url, e)
                })
            }).catch(function(e) {
                return _this.errorCallback(url, e)
            })
            return controller;
        },
        callback: function(url, data) {
            if (!url) {
                return
            }
            this.data = data;
            this.finishURL(url, false);
        },
        apply: function() {
            if (!this.finishedUrl || this.applied) {
                return
            }
            let url = this.finishedUrl;
            let data = this.data;
            if (this.userCallback) {
                this.userCallback(data);
                this.applied = true;
            } else {
                let target = document.head || document.getElementsByTagName("head")[0];
                let node;
                if (url.endsWith('.js')) {
                    if (this.link && !IE) {
                        node = document.createElement('link');
                        node.rel = 'preload';
                        node.as = 'script';
                        node.href = url;
                    } else {
                        node = document.createElement('script');
                        node.type = 'text/javascript';
                        if (this.doLoad && !this.link) {
                            node.innerHTML = data;
                        } else {
                            target = document.body || document.getElementsByTagName("body")[0];
                            node.src = url;
                        }
                    }
                    if(this.link){
                        let _this = this;
                        node.onload = function () {
                            if(!IE){
                                const script = document.createElement('script');
                                script.src = url;
                                document.body.appendChild(script);
                            }
                            _this.applied = true;
                            _this.reporter(_this, url, false)
                        }
                        target.appendChild(node);
                    }
                    target.appendChild(node);
                    if(!this.link){
                        this.applied = true;
                    }
                }
                if (url.endsWith('.css')) {
                    if (this.link || !this.doLoad) {
                        const node = document.createElement('link');
                        node.href = url;
                        node.rel = 'stylesheet'
                        node.type = 'text/css'
                        target.appendChild(node);
                    } else {
                        const node = document.createElement('style');
                        node.innerHTML = data;
                        target.appendChild(node);
                    }
                    this.applied = true;
                }
            }
        },
        errorCallback: function(url) {
            this.finishURL(url, true)
        },
        getAvailableUrls: function() {
            // apply priority / randomness in this function
            let priorities = this.priorityGetter ? this.priorityGetter() : null;
            let urls = []
            let length = this.urls.length;
            let _this = this;
            this.urls.forEach(function(urlObject){
                let url = urlObject.url;
                if (_this.loadingController[url] || _this.errorUrls.includes(url)) {
                    return
                }
                let priority = priorities ? (priorities[url.host] || null) : null;
                if (priority === null) {
                    priority = _this.random ? (Math.random() * length) : 0;
                }
                urlObject.priority = priority;
                urls.push(urlObject)
            })
            return sortBy(urls, ['-priority']);
        },
        load: function() {
            if (!this.doLoad && !this.finished) {
                let url = this.urls.length ? this.urls[0].url : null;
                if (url) {
                    this.finishedUrl = url;
                    this.finished = true;
                    if (this.reporter) {
                        this.reporter(this, url, false);
                    }
                }
                return;
            }
            if(this.errorUrls.length === this.urls.length){

            }
            let urls = this.getAvailableUrls();
            for (let i in urls) {
                if(!urls.hasOwnProperty(i)){
                    continue;
                }
                let urlObject = urls[i];
                this.loadingController[urlObject.url] = this.fetchURL(
                    urlObject.url,
                    urlObject.timeout,
                    urlObject.responseTimeout
                )
                if (this.concurrency && Object.keys(this.loadingController).length >= this.concurrency) {
                    // hit concurrency
                    return
                }
            }
        }
    }
}

const DistributedLoader = {
    loaders: [],
    finishedLoaders: {},
    hostPriority: {},
    initLoaders: function (resources, defaultConfig) {
        let loaders = [];
        function getConfig(settings, key, defaultValue) {
            for (let i in settings) {
                if(!settings.hasOwnProperty(i)){
                    continue
                }
                let setting = settings[i];
                if (setting && typeof setting === 'object' && setting[key] !== undefined) {
                    return setting[key]
                }
            }
            return defaultValue
        }
        let _this = this;
        let polyfillDependencies = [];
        resources.forEach(function (src) {
            if (!src || typeof src !== 'object') {
                return
            }
            if (!src.urls) {
                // invalid dep
                return;
            }
            let name = src.name || ('resource:' + loaders.length);
            let dependency = Array.isArray(src.dependency) ? src.dependency : (src.dependency ? [src.dependency] : []);
            if(IE){
                if(src.polyfill){
                    polyfillDependencies.push(name);
                }
                if(src.polyfillRequired){
                    dependency = dependency.concat(polyfillDependencies);
                }
            }else if(src.polyfill){
                return;
            }
            loaders.push(ResourceLoader({
                name: name,
                dependency: dependency,
                urls: Array.isArray(src.urls) ? src.urls : [src.urls],
                concurrency: getConfig([src, defaultConfig], 'concurrency', 1),
                random: getConfig([src, defaultConfig], 'random', false),
                load: getConfig([src, defaultConfig], 'load', true),
                link: getConfig([src, defaultConfig], 'link', false),
                timeout: getConfig([src, defaultConfig], 'timeout', null),
                responseTimeout: getConfig([src, defaultConfig], 'responseTimeout', null),
                callback: getConfig([src, defaultConfig], 'callback', null),
                reporter: function(args) {return _this.report(args)},
                priorityGetter: function() {return _this.hostPriority}
            }))
        })
        this.loaders = loaders;
    },
    report: function(loader, url, error) {
        let host = null;
        try {
            let obj = new URL(url);
            host = obj.host;
        } catch (e) {
        }
        if(host){
            if (!this.hostPriority[host]) {
                this.hostPriority[host] = 0;
            }
            this.hostPriority[host] += error ? -1 : 1;
        }
        if (!error) {
            // finished
            if (loader.applied) {
                this.applyLoaders(loader.name)
            } else {
                this.finishedLoaders[loader.name] = loader;
                this.applyLoader(loader);
            }
        }
    },
    applyLoader: function(loader) {
        if (loader.applied) {
            return false
        }
        let depFinished = true;
        if(loader.dependency && loader.dependency.length){
            for (let i = 0; i < loader.dependency.length; i ++) {
                let dep = loader.dependency[i];
                if (!dep) {
                    continue
                }
                let depLoader = this.finishedLoaders[dep];
                if (!depLoader) {
                    depFinished = false;
                    break
                }
                if (!depLoader.applied) {
                    depFinished = false;
                    break
                }
            }
        }

        if (!depFinished) {
            return false;
        }
        try {
            loader.apply();
        }
        catch (e) {
            return false;
        }
        if (loader.applied) {
            this.applyLoaders(loader.name);
        }
        return true;
    },
    applyLoaders: function(dep) {
        let _this = this;
        for(let k in this.finishedLoaders){
            let finishLoader = this.finishedLoaders[k];
            if(finishLoader.applied || finishLoader.name === dep){
                continue
            }
            if (dep) {
                if (!finishLoader.dependency
                    || !finishLoader.dependency.length
                    || !finishLoader.dependency.includes(dep)) {
                    continue
                }
            }
            _this.applyLoader(finishLoader);
        }
    },
    loadAll: function() {
        this.loaders.forEach(function (loader){
            loader.load();
        })
    }
}

function loadResources(resources, defaultConfig) {
    DistributedLoader.initLoaders(resources, defaultConfig);
    DistributedLoader.loadAll();
}