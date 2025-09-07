<?php
function virat_theme_assets() {
    $assets_url = get_template_directory_uri() . '/assets';

    // Enqueue main CSS
    wp_enqueue_style('virat-style', $assets_url . '/styles.css');

    // Enqueue main JS
    wp_enqueue_script('virat-script', $assets_url . '/script.js', array(), null, true);
}
add_action('wp_enqueue_scripts', 'virat_theme_assets');
