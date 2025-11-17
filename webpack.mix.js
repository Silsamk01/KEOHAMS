const mix = require('laravel-mix');

/*
 |--------------------------------------------------------------------------
 | Mix Asset Management
 |--------------------------------------------------------------------------
 |
 | Mix provides a clean, fluent API for defining some Webpack build steps
 | for your Laravel applications. By default, we are compiling the CSS
 | file for the application as well as bundling up all the JS files.
 |
 */

mix.js('resources/js/app.js', 'public/js')
   .js('resources/js/admin.js', 'public/js')
   .postCss('resources/css/app.css', 'public/css', [
       require('postcss-import'),
       require('tailwindcss'),
       require('autoprefixer'),
   ])
   .postCss('resources/css/admin.css', 'public/css');

// Production optimizations
if (mix.inProduction()) {
    mix.version()
       .sourceMaps(false)
       .options({
           terser: {
               terserOptions: {
                   compress: {
                       drop_console: true,
                   },
               },
           },
           cssNano: {
               preset: ['default', {
                   discardComments: {
                       removeAll: true,
                   },
               }],
           },
       });
} else {
    mix.sourceMaps()
       .webpackConfig({
           devtool: 'inline-source-map',
       });
}

// BrowserSync for live reloading
mix.browserSync({
    proxy: 'localhost:8000',
    files: [
        'app/**/*.php',
        'resources/views/**/*.php',
        'public/js/**/*.js',
        'public/css/**/*.css'
    ],
    notify: false,
});

// Extract vendor libraries
mix.extract(['lodash', 'axios']);

// Disable OS notifications
mix.disableNotifications();
