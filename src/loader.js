function sortBy(values, ...orders){
    if(!values || !values.length){
        return [];
    }
    function genSorter(field, flag=1) {
        function sort(a, b){
            return a[field] > b[field] ? flag : (a[field] < b[field] ? -flag : 0);
        }
        return sort;
    }
    for(let order of orders){
        let desc = order.startsWith('-');
        let field = desc ? order.substr(1) : order;
        values.sort(genSorter(field, desc ? -1 : 1));
    }
    return values;
}

// analyze host of the url, if a url is slow or error, probably the entire host is unavailable
// notify other pending loader to downgrade this host

class ResourceLoader{
    constructor({
        name='',
        dependency=[],
        urls= [],
        concurrency=1,     // default
        random=false,
        timeout=null,
        load=true,
        required=true,
        responseTimeout=null,
        reporter=()=>({}),
        priorityGetter=()=>null,
        callback=null,
    }) {

        let validUrls = [];
        if(urls && Array.isArray(urls) && urls.length){
            for(let url of urls){
                if(!url){
                    continue
                }
                let urlObject = {}
                if(typeof url === 'object'){
                    urlObject = this.validURL(url.url);
                    if(urlObject){
                        urlObject.timeout = url.timeout || timeout;
                        urlObject.responseTimeout = url.responseTimeout || responseTimeout;
                    }
                }
                else{
                    urlObject = this.validURL(url);
                    if(urlObject){
                        urlObject.timeout = timeout;
                        urlObject.responseTimeout = responseTimeout;
                    }
                }
                if(!urlObject){
                    continue
                }
                validUrls.push(urlObject);
            }
        }

        this.urls = validUrls;
        this.name = name;
        this.doLoad = load;
        this.dependency = dependency
        this.concurrency = concurrency
        this.timeout = timeout;
        this.responseTimeout = responseTimeout;
        this.userCallback = callback
        this.reporter = reporter;
        this.priorityGetter = priorityGetter;
        this.random = random;
        this.loadingController = {};
        // url: abortController, use object to enable concurrency safe
        this.errorUrls = [];
        this.required = required
        this.finished = false;
        this.applied = false;
        this.finishedUrl = null;
        this.data = null;
    }

    validURL(url){
        if(!url){
            return null;
        }
        if(typeof url !== 'string'){
            return null;
        }
        if(url.startsWith('http://') || url.startsWith('https://')){
            try {
                let urlObj = new URL(url);
                return {
                    url: url,
                    host: urlObj.host
                }
            }catch (e) {
                // invalid url
                return null;
            }
        }else if(!url.startsWith('/')){
            return null
        }
        return {
            url: url,
            host: null
        }
    }

    finishURL(url, error=false){
        let controller = this.loadingController[url];
        if(!controller){
            // already finish
            return
        }
        delete this.loadingController[url];
        if(error){
            this.errorUrls.push(url);
        }else{
            // if successfully finish, abort all pending fetch urls
            for(let controller of Object.values(this.loadingController)){
                try {
                    controller.abort()
                }catch (e) {
                    // ignore abort error
                    console.log(e);
                }
            }
            this.loadingController = {};    // reset
            this.finishedUrl = url;
            this.finished = true;
        }
        if(this.reporter){
            this.reporter(this, url, error);
        }
        if(this.finished){
            return;
        }
        // check concurrency
        if(!this.concurrency || Object.keys(this.loadingController).length < this.concurrency){
            this.load();    // load again
        }
    }

    fetchURL(url, timeout=null, responseTimeout=null) {
        // response timeout means the download
        const controller = new AbortController()
        const requestTimeoutController = timeout ? setTimeout(()=>{
            controller.abort();
        }, timeout) : null;
        const responseTimeoutController = responseTimeout ? setTimeout(()=>{
            controller.abort();
        }, responseTimeout) : null;

        fetch(url, { signal: timeout ? controller.signal : null }).then(response => {
            clearTimeout(requestTimeoutController);
            if(response.status >= 400 || response.status < 200){
                return this.errorCallback(url, response)
            }
            response.text().then(data=>{
                clearTimeout(responseTimeoutController);
                return this.callback(url, data)
            }).catch(e=>{
                return this.errorCallback(url, e)
            })
        }).catch(e=>{
            return this.errorCallback(url, e)
        })
        return controller;
    }

    callback(url, data){
        if(!url){
            return
        }
        this.data = data;
        this.finishURL(url, false);
    }

    apply(){
        if(!this.finishedUrl || !this.data || this.applied){
            return
        }
        let url = this.finishedUrl;
        let data = this.data;
        if(this.userCallback){
            this.userCallback(data);
        }else{
            let head = document.head || document.getElementsByTagName("head")[0]
            if(url.endsWith('.js')){
                const node = document.createElement('script');
                node.type = 'text/javascript';
                if(this.doLoad){
                    node.innerHTML = data;
                }else{
                    node.src = url;
                }
                head.appendChild(node);
            }
            if(url.endsWith('.css')){
                const node = document.createElement('style');
                if(this.doLoad){
                    node.innerHTML = data;
                }else{
                    node.src = url;
                }
                head.appendChild(node);
            }
        }
        this.applied = true;
    }

    errorCallback(url){
        this.finishURL(url, true)
    }

    getAvailableUrls(){
        // apply priority / randomness in this function
        let priorities = this.priorityGetter ? this.priorityGetter() : null;
        let urls = []
        for(let urlObject of this.urls){
            let url = urlObject.url;
            if(this.loadingController[url] || this.errorUrls.includes(url)){
                continue
            }
            let priority = priorities ? (priorities[url.host] || null) : null;
            if(priority === null){
                priority = this.random ? (Math.random() * this.urls.length) : 0;
            }
            urls.push(Object.assign({
                priority: priority
            }, urlObject))
            // order urls based on -priority
        }
        return sortBy(urls, '-priority');
    }

    load(){
        if(!this.doLoad){
            return this.callback(this.urls.length ? this.urls[0].url : null, '');
        }
        for(let urlObject of this.getAvailableUrls()){
            this.loadingController[urlObject.url] = this.fetchURL(
                urlObject.url,
                urlObject.timeout,
                urlObject.responseTimeout
            )
            if(this.concurrency && Object.keys(this.loadingController).length >= this.concurrency){
                // hit concurrency
                return
            }
        }
    }
}

class DistributedResourcesLoader {
    constructor({
        resources=[],
        concurrency=null,
        random=false
    }) {
        let loaders = [];
        for(let src of resources){
            if(!src || typeof src !== 'object'){
                continue
            }
            if(!src.urls){
                // invalid dep
                continue
            }
            loaders.push(new ResourceLoader({
                name: src.name || `resource[${loaders.length}]`,
                dependency: Array.isArray(src.dependency) ? src.dependency : (src.dependency ? [src.dependency] : []),
                urls: Array.isArray(src.urls) ? src.urls : [src.urls],
                concurrency: src.concurrency || 1,
                random: src.random || random,
                load: src.load,
                reporter: args => this.report(args),
                timeout: src.timeout,
                responseTimeout: src.responseTimeout,
                callback: src.callback,
                priorityGetter: () => this.priorityGetter()
            }))
        }

        this.loaders = loaders;
        this.finishedLoaders = {};
        this.hostPriotity = {}
        // if a host occur a error, add -1 to the priority, otherwise add +1,
        // the more priority the host get, the more recently it get requested
    }

    priorityGetter(){
        return this.hostPriotity;
    }

    report(loader, url, error=false){
        try {
            let obj = new URL(url);
            if(!this.hostPriotity[url]){
                this.hostPriotity[url] = 0;
            }
            this.hostPriotity[obj.host] += error ? -1 : 1;
        }catch (e) {
        }
        if(!error){
            // finished
            console.log('FINISH:', loader.name);
            this.finishedLoaders[loader.name] = loader;
            this.applyLoader(loader);
            if(loader.applied){
                this.applyLoaders();
            }
        }
    }

    applyLoader(loader){
        if(loader.applied){
            return
        }
        let depFinished = true;
        for(let dep of loader.dependency || []){
            if(!dep){
                continue
            }
            let depLoader = this.finishedLoaders[dep];
            if(!depLoader){
                depFinished = false;
                break
            }
            if(!depLoader.applied){
                depFinished = false;
                break
            }
        }
        if(depFinished){
            loader.apply();
        }
    }
    applyLoaders(){
        for(let finishLoader of Object.values(this.finishedLoaders)){
            this.applyLoader(finishLoader);
        }
    }

    loadAll(){
        for(let loader of this.loaders){
            loader.load();
        }
    }
}

function loadResources(resources) {
    // format: {name: "Axios", urls: [<a bunch of url>>], timeout: <milliseconds>}
    new DistributedResourcesLoader({
        resources: resources
    }).loadAll()
}

// export default {
//     DistributedResourcesLoader,
//     ResourceLoader,
//     loadResources(resources) {
//         // format: {name: "Axios", urls: [<a bunch of url>>], timeout: <milliseconds>}
//         new DistributedResourcesLoader({
//             resources: resources
//         }).loadAll()
//     }
// }