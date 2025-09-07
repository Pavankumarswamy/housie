<!DOCTYPE html>
<html <?php language_attributes(); ?> dir="ltr">
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <title><?php bloginfo('name'); ?> | <?php bloginfo('description'); ?></title>

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="<?php echo get_template_directory_uri(); ?>/assets/favicon.png">

    <!-- SEO Meta -->
    <meta name="description" content="Tambola-Tron: SPKS Generated Project offering an engaging and interactive experience.">
    <meta name="author" content="Lovable">
    <meta name="keywords" content="Tambola-Tron, Spks, Interactive Project, Web Application, Online Game">
    <meta name="robots" content="index, follow">

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <!-- Open Graph -->
    <meta property="og:title" content="Tambola-Tron | Lovable Generated Project">
    <meta property="og:description" content="Discover Tambola-Tron, an interactive project by Lovable designed for an engaging user experience.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo home_url(); ?>">
    <meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png">
    <meta property="og:site_name" content="Tambola-Tron">
    <meta property="og:locale" content="en_US">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Tambola-Tron | Lovable Generated Project">
    <meta name="twitter:description" content="Discover Tambola-Tron, an interactive project by Lovable designed for an engaging user experience.">
    <meta name="twitter:image" content="https://lovable.dev/opengraph-image-p98pqg.png">
    <meta name="twitter:site" content="@lovable_dev">

    <!-- Schema.org -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Tambola-Tron",
      "url": "<?php echo home_url(); ?>",
      "description": "Tambola-Tron: Pavan Generated Project offering an engaging and interactive experience.",
      "creator": {
        "@type": "Organization",
        "name": "Pavankumarswamy",
        "url": "https://ggusoc.in/"
      },
      "applicationCategory": "Game"
    }
    </script>

    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?> role="document">
    <main id="root" aria-live="polite">
        <?php
        if ( have_posts() ) :
            while ( have_posts() ) : the_post();
                the_content();
            endwhile;
        else :
            echo '<p>No content found.</p>';
        endif;
        ?>
    </main>

    <?php wp_footer(); ?>
</body>
</html>
