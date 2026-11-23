import {pageSize,outputSize} from './page.mjs';

// Labels and data live in JSON/CSV sidecars, never in evaluated R expressions.
export function mapR(state,{width=3000}={}){
 const page=pageSize(state.settings);outputSize(state.settings,width);
 return String.raw`# SPTopo — reproduce the exported map in R (generator 1)
# Unzip the complete map package first. This script needs its JSON/CSV/PNG files.
# Run: Rscript map.R
# In RStudio/Positron: open map.R and Source it; select map_scene.json if asked.
# Basemap: fixed-view raster. Points, pies, legends and annotations: native R grid.
# Geographic extent/projection and merged site coordinates were computed on the website.
# To change geography or occurrence coordinates, export a new package from the website.

config <- list(
  package_dir = ".",              # folder containing map_scene.json
  output_width_cm = ${page.widthCm},
  output_pixels = ${width},       # PNG width; height keeps the original aspect ratio
  formats = c("png", "pdf", "svg"),
  point_scale = 1,                # map symbols only
  text_scale = 1,                 # annotations and legend text
  legend_symbol_scale = 1,
  show_points = TRUE,
  show_legends = TRUE,
  show_site_ids = ${state.settings.siteNumbers?'TRUE':'FALSE'},
  font_family = "",              # optional installed font, e.g. Noto Sans CJK TC
  legend_italic = NA              # NA keeps website style; TRUE/FALSE overrides legend text
)

# Change colors, shapes and display names in taxa.csv before running.
# map_points.csv contains the exported site grouping and fixed-view drawing positions.
# occurrences.csv preserves the selected original WGS84 record coordinates for reference.
# Advanced edits: commands in map_scene.json contain legend positions/text/font styles.
# R and browser fonts can differ. A local font covering your language is recommended.
# A larger PNG does not add terrain detail to the packaged basemap.

main <- function(config) {
  required <- c("jsonlite", "png")
  missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing)) install.packages(missing, repos = "https://cloud.r-project.org")
  if (any(!vapply(required, requireNamespace, logical(1), quietly = TRUE)))
    stop("Install the jsonlite and png packages, then run map.R again.")
  if (!capabilities("cairo")) stop("This R installation needs Cairo support for PNG/PDF/SVG output.")
  package_files <- c("map_scene.json", "basemap.png", "map_points.csv", "taxa.csv")
  folder <- config$package_dir
  if (!file.exists(file.path(folder, "map_scene.json"))) {
    script_arg <- grep("^--file=", commandArgs(FALSE), value = TRUE)
    if (length(script_arg)) folder <- dirname(normalizePath(sub("^--file=", "", script_arg[1]), mustWork = TRUE))
  }
  if (!file.exists(file.path(folder, "map_scene.json")) && interactive()) {
    message("Choose map_scene.json from the unzipped SPTopo map package.")
    folder <- dirname(file.choose())
  }
  absent <- package_files[!file.exists(file.path(folder, package_files))]
  if (length(absent)) stop(paste("Unzip the complete R map package. Missing:", paste(absent, collapse = ", "),
                                "Use files from the same export; a raw occurrence CSV alone is not a map package."))
  folder <- normalizePath(folder, mustWork = TRUE)
  scene <- jsonlite::fromJSON(file.path(folder, "map_scene.json"), simplifyVector = FALSE)
  if (!identical(scene$application, "WorldBioTopoMaps map recipe") || scene$version != 1)
    stop("Unsupported map package. Download a new map package from the website.")
  read_table <- function(name) utils::read.csv(file.path(folder, name), fileEncoding = "UTF-8-BOM",
                     colClasses = "character", check.names = FALSE, na.strings = NULL)
  points <- read_table("map_points.csv")
  taxa <- read_table("taxa.csv")
  expect <- function(x, names, file) if (!all(names %in% colnames(x))) stop(paste("Missing columns in", file))
  expect(points, c("site_key", "site_id", "map_x", "map_y", "radius", "taxon", "value"), "map_points.csv")
  expect(taxa, c("taxon", "color", "shape", "display_name"), "taxa.csv")
  if (anyDuplicated(taxa$taxon)) stop("taxa.csv contains duplicate taxon keys.")
  if (any(!points$taxon %in% taxa$taxon)) stop("A map_points.csv taxon is missing from taxa.csv.")
  for (key in c("map_x", "map_y", "radius", "value")) {
    points[[key]] <- suppressWarnings(as.numeric(points[[key]]))
    if (any(!is.finite(points[[key]]))) stop(paste("Non-numeric values in map_points.csv:", key))
  }
  if (any(points$radius <= 0 | points$value <= 0)) stop("Point radius and pie values must be positive.")
  if (any(!taxa$shape %in% c("circle", names(scene$shapes)))) stop("Unknown marker shape in taxa.csv; use the names in map_scene.json.")
  if (any(!grepl("^#[0-9a-fA-F]{6}$", taxa$color))) stop("Use six-digit hex colors in taxa.csv, e.g. #0072b2.")
  for (key in c("output_width_cm", "output_pixels", "point_scale", "text_scale", "legend_symbol_scale"))
    if (length(config[[key]]) != 1 || !is.finite(config[[key]]) || config[[key]] <= 0) stop(paste("Invalid setting:", key))
  if (!length(config$formats) || any(!config$formats %in% c("png", "pdf", "svg"))) stop("formats must contain png, pdf and/or svg.")
  w <- scene$page$width; h <- scene$page$height; plot <- scene$plot
  inches <- config$output_width_cm / 2.54
  unit_in <- inches / w
  pixels <- round(config$output_pixels); pixel_height <- round(pixels * h / w)
  if (pixels < 100 || pixels * pixel_height > 64e6) stop("PNG dimensions must be at least 100 px wide and at most 64 million pixels.")
  basemap <- png::readPNG(file.path(folder, "basemap.png"), native = TRUE)
  color <- function(x) if (is.null(x) || identical(x, "none")) NA_character_ else x
  gp <- function(fill = "none", stroke = "none", width = 1, opacity = 1)
    grid::gpar(fill = color(fill), col = if (width > 0) color(stroke) else NA,
               lwd = width * unit_in * 96, alpha = opacity, linejoin = "round", lineend = "butt")
  frame <- list(x = 0, y = 0, w = w, h = h)
  X <- function(x) (x - frame$x) / frame$w
  Y <- function(y) 1 - (y - frame$y) / frame$h
  enter <- function(clip) {
    frame <<- if (clip) plot else list(x = 0, y = 0, w = w, h = h)
    grid::pushViewport(grid::viewport(x = frame$x/w, y = 1-frame$y/h,
      width = frame$w/w, height = frame$h/h, just = c("left", "top"), clip = "on"))
  }
  path <- function(paths, fill, stroke, width, opacity = 1) {
    if (!length(paths)) return(invisible(NULL))
    coords <- lapply(paths, function(p) do.call(rbind, lapply(p$points, function(q) as.numeric(unlist(q)))))
    if (!identical(fill, "none")) {
      xy <- do.call(rbind, coords)
      grid::grid.path(X(xy[,1]), Y(xy[,2]), id.lengths = vapply(coords, nrow, integer(1)),
                      rule = "evenodd", gp = gp(fill, "none", 0, opacity))
    }
    if (!identical(stroke, "none") && width > 0) for (i in seq_along(coords)) {
      xy <- coords[[i]]; if (isTRUE(paths[[i]]$closed)) xy <- rbind(xy, xy[1,,drop=FALSE])
      grid::grid.lines(X(xy[,1]), Y(xy[,2]), gp = gp("none", stroke, width, opacity))
    }
  }
  marker <- function(x, y, radius, shape, fill, stroke = "#26372b", width = .9) {
    if (shape == "circle") grid::grid.circle(X(x), Y(y), r = grid::unit(radius * unit_in, "inches"), gp = gp(fill, stroke, width))
    else {
      paths <- lapply(scene$shapes[[shape]], function(p) {
        p$points <- lapply(p$points, function(q) c(x + q[[1]] * radius, y + q[[2]] * radius)); p
      })
      path(paths, fill, stroke, width)
    }
  }
  text <- function(label, x, y, size, col, italic = FALSE, bold = FALSE, family = "Arial", align = "left") {
    family <- if (nzchar(config$font_family)) config$font_family else switch(family, Arial = "sans", Georgia = "serif", monospace = "mono", family)
    # Correct bottom justification for the glyph descent to match an alphabetic baseline.
    grid::grid.text(label, x = X(x), just = c(align, "bottom"),
      y = grid::unit(Y(y), "npc") - grid::grobDescent(grid::textGrob(label,
        gp = grid::gpar(fontfamily = family, fontsize = size * config$text_scale * unit_in * 72,
                        fontface = if (bold && italic) "bold.italic" else if (bold) "bold" else if (italic) "italic" else "plain"))),
      gp = grid::gpar(col = col, fontsize = size * config$text_scale * unit_in * 72, fontfamily = family,
                      fontface = if (bold && italic) "bold.italic" else if (bold) "bold" else if (italic) "italic" else "plain"))
  }
  draw_points <- function() {
    if (!isTRUE(config$show_points) || !nrow(points)) return(invisible(NULL))
    enter(TRUE); on.exit(grid::popViewport())
    site_rows <- split(seq_len(nrow(points)), factor(points$site_key, levels = unique(points$site_key)))
    for (indices in site_rows) {
      rows <- points[indices,,drop=FALSE]
      x <- rows$map_x[1]; y <- rows$map_y[1]; r <- rows$radius[1] * config$point_scale
      index <- match(rows$taxon, taxa$taxon); shape <- if(nrow(rows) == 1) taxa$shape[index] else "circle"
      if (isTRUE(scene$pointHalo)) marker(x, y, r + 1.5, shape, "#ffffffd9", "none", 0)
      if (nrow(rows) == 1) marker(x, y, r, shape, taxa$color[index]) else {
        angle <- -pi/2
        for (j in seq_len(nrow(rows))) {
          end <- angle + rows$value[j]/sum(rows$value)*2*pi
          a <- seq(angle, end, length.out = max(3, ceiling((end-angle)*r/0.3)))
          xy <- cbind(c(x, x+r*cos(a)), c(y, y+r*sin(a)))
          path(list(list(points = lapply(seq_len(nrow(xy)), function(k) xy[k,]), closed = TRUE)), taxa$color[index[j]], "#ffffff", .45)
          angle <- end
        }
        marker(x, y, r, "circle", "none")
      }
      if (isTRUE(config$show_site_ids) && nzchar(rows$site_id[1])) {
        label <- rows$site_id[1]; size <- scene$siteLabelSize
        tg <- grid::textGrob(label, gp = grid::gpar(fontsize = size*config$text_scale*unit_in*72, fontface = "bold", fontfamily = if(nzchar(config$font_family)) config$font_family else "sans"))
        label_width <- grid::convertWidth(grid::grobWidth(tg), "inches", valueOnly = TRUE)/unit_in + 8
        lx <- max(plot$x+4, min(plot$x+plot$w-label_width-4, x+r+5)); ly <- max(plot$y+size+5, min(plot$y+plot$h-5, y-r-3))
        grid::grid.rect(X(lx-3), Y(ly-size-2), width = (label_width)/frame$w, height = (size+6)/frame$h,
                        just = c("left", "top"), gp = gp("#fffffff0", "none", 0))
        text(label, lx+1, ly, size, "#25352d", bold = TRUE)
      }
    }
  }
  draw_command <- function(d) {
    if (startsWith(d$layer, "legend-") && !isTRUE(config$show_legends)) return(invisible(NULL))
    enter(isTRUE(d$clip)); on.exit(grid::popViewport())
    if (!is.null(d$taxon)) {
      i <- match(d$taxon, taxa$taxon)
      if (is.na(i)) stop("Legend taxon missing from taxa.csv.")
      if (d$type == "marker") {d$fill <- taxa$color[i]; d$shape <- taxa$shape[i]}
      if (d$type == "text") d$text <- taxa$display_name[i]
    }
    if (d$type == "path") path(d$paths, d$fill, d$stroke, d$width, d$opacity)
    else if (d$type == "rect") grid::grid.rect(X(d$x), Y(d$y), width = d$w/frame$w, height = d$h/frame$h,
                      just = c("left", "top"), gp = gp(d$fill, d$stroke, d$width))
    else if (d$type %in% c("circle", "marker")) marker(d$x, d$y,
          d$r * if(startsWith(d$layer, "legend-")) config$legend_symbol_scale else 1,
          if(d$type == "circle") "circle" else d$shape, d$fill, d$stroke, d$width)
    else if (d$type == "text") {
      italic <- d$italic
      if (startsWith(d$layer, "legend-") && !is.na(config$legend_italic)) italic <- config$legend_italic
      text(d$text, d$x, d$y, d$size, d$color, italic, d$weight != "normal", d$font, d$align)
    } else if (d$type == "gradient") {
      stops <- vapply(d$stops, function(s) s[[1]], numeric(1)); colors <- vapply(d$stops, function(s) s[[2]], character(1))
      rgb <- grDevices::col2rgb(colors); n <- max(256, ceiling(d$h * pixels/w))
      at <- seq(0, 1, length.out = n)
      channels <- lapply(1:3, function(j) stats::approx(stops, rgb[j,], xout = at, rule = 2)$y)
      gradient <- as.raster(matrix(grDevices::rgb(channels[[1]], channels[[2]], channels[[3]], maxColorValue = 255), ncol = 1))
      grid::grid.raster(gradient, X(d$x), Y(d$y), width = d$w/frame$w, height = d$h/frame$h,
                        just = c("left", "top"), interpolate = TRUE)
    } else stop(paste("Unknown drawing primitive:", d$type))
  }
  draw_map <- function() {
    grid::grid.newpage(); grid::grid.raster(basemap, width = 1, height = 1, interpolate = TRUE)
    draw_points()
    for (d in scene$commands) draw_command(d)
  }
  out <- file.path(folder, "output", paste0("map_", format(Sys.time(), "%Y%m%d_%H%M%S")))
  base <- out; n <- 1
  while (dir.exists(out)) {n <- n+1; out <- paste0(base, "_", n)}
  dir.create(out, recursive = TRUE)
  dput(config, file = file.path(out, "settings.R"))
  on.exit(writeLines(capture.output(sessionInfo()), file.path(out, "sessionInfo.txt")), add = TRUE)
  render_file <- function(format) {
    target <- file.path(out, paste0("map.", format))
    if (format == "png") grDevices::png(target, width = pixels, height = pixel_height, res = pixels/inches, type = "cairo")
    else if (format == "pdf") grDevices::cairo_pdf(target, width = inches, height = inches*h/w)
    else grDevices::svg(target, width = inches, height = inches*h/w, onefile = TRUE)
    on.exit(grDevices::dev.off())
    draw_map()
  }
  for (format in unique(config$formats)) render_file(format)
  message("Map written to: ", normalizePath(out))
  invisible(out)
}
main(config)
`;
}
