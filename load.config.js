module.exports = {
    outputDir: 'dist',
    // templatePath: 'public/load.template.html',
    indexPath: 'index.html',
    devIndexPath: 'public/index.html',
    appDirs: [{
        path: 'css',    // relative to outputDir
        independent: true,   // css files does not have dependencies based on resources
        load: false,
        defaultFiles: ['app.css', 'chunk-vendors.css']  // used for dev
    }, {
        path: 'js',
        link: false,
        defaultFiles: ['app.js', 'chunk-vendors.js']
    }],
    defaultConfig: {
        timeout: 3000,
        responseTimeout: 10000,
        concurrency: 2,
        random: true,
    },
    resources: [{
        name: 'core-js',
        urls: [
            'https://cdnjs.cloudflare.com/ajax/libs/core-js/3.22.5/minified.js',
        ],
        polyfill: true,
    }, {
        name: 'vuetify.css',
        urls: [
            "https://unpkg.com/vuetify@2/dist/vuetify.min.css",
            "https://cdn.jsdelivr.net/npm/vuetify@2/dist/vuetify.min.css",
            "https://cdnjs.cloudflare.com/ajax/libs/vuetify/2.6.6/vuetify.min.css",
        ]
    },{
        name: 'highlightjs.css',
        urls: [
            "https://unpkg.com/@highlightjs/cdn-assets@11.5.1/styles/atom-one-dark.min.css",
            "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.1//styles/atom-one-dark.min.css",
            "https://cdn.jsdelivr.net/npm/highlight.js@@11.5.1/styles/atom-one-dark.min.css",
        ]
    }, {
        name: 'axios',
        appEssentials: true,
        urls: [
            "https://unpkg.com/axios@0.19.2/dist/axios.min.js",
            "https://cdn.jsdelivr.net/npm/axios@0.19.2/dist/axios.min.js",
            "https://cdn.bootcdn.net/ajax/libs/axios/0.19.2/axios.min.js",
        ]
    }, {
        name: 'js-sha256',
        appEssentials: true,
        urls: [
            "https://unpkg.com/js-sha256@0.9.0/src/sha256.js",
            "https://cdn.jsdelivr.net/npm/js-sha256@0.x/src/sha256.min.js",
        ]
    }, {
        name: 'apexchart',
        urls: [
            "https://unpkg.com/apexcharts@3.28.3/dist/apexcharts.min.js",
            "https://cdn.jsdelivr.net/npm/apexcharts@3.28.3/dist/apexcharts.min.js",
        ]
    }, {
        name: 'vue-apexchart',
        dependency: ['apexchart'],
        appEssentials: true,
        urls: [
            "https://unpkg.com/vue-apexcharts@1.6.2/dist/vue-apexcharts.js",
            "https://cdn.jsdelivr.net/npm/vue-apexcharts@1.6.2/dist/vue-apexcharts.min.js",
        ]
    }, {
        name: 'vue',
        appEssentials: true,
        concurrency: 3,
        urls: [
            "https://unpkg.com/vue@2.6.11/dist/vue.js",
            "https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue.js",
            "https://cdn.bootcdn.net/ajax/libs/vue/2.6.11/vue.js"
        ]
    }, {
        name: 'vue-router',
        dependency: ['vue'],
        appEssentials: true,
        urls: [
            "https://unpkg.com/vue-router@3.5.4/dist/vue-router.min.js",
            "https://cdn.jsdelivr.net/npm/vue-router@3.5.4/dist/vue-router.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/vue-router/3.5.4/vue-router.min.js"
        ]
    }, {
        name: 'vuex',
        dependency: ['vue'],
        appEssentials: true,
        urls: [
            "https://unpkg.com/vuex@3.5.1/dist/vuex.min.js",
            "https://cdn.jsdelivr.net/npm/vuex@3.5.1/dist/vuex.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/vuex/3.5.1/vuex.min.js"
        ]
    }, {
        name: 'vue-18n',
        dependency: ['vue'],
        appEssentials: true,
        urls: [
            "https://unpkg.com/vue-i18n@8.18.2/dist/vue-i18n.min.js",
            "https://cdn.jsdelivr.net/npm/vue-i18n@8.18.2/dist/vue-i18n.min.js",
        ]
    }, {
        name: 'vuetify',
        dependency: ['vue'],
        appEssentials: true,
        polyfillRequired: true,
        urls: [
            "https://unpkg.com/vuetify@2/dist/vuetify.min.js",
            "https://cdn.jsdelivr.net/npm/vuetify@2/dist/vuetify.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/vuetify/2.6.6/vuetify.min.js",
        ]
    }]
}