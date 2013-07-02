﻿/**
 * Folder2Sprite Photoshop Script
 *
 * @fileOverview    Creates a single sprite from a folder of images, outputting
 *                  the final coordinates of each image as CSS or JSON. Based
 *                  off the "Import Folder as Layers" script by Trevor Morris.
 *
 *                  To run this script, double-click the icon, or from within
 *                  Photoshop, go to File > Scripts > Browse... and select
 *                  this file.
 *
 * @author          Kevin Sweeney
 * @version         1.0
 */

// User Variables ____________________________________________________________

/**
 * @type {String}
 *
 * Specifies the direction that elements will be laid out in. Accepted values:
 * - "cols" (default)
 * - "rows"
 */
var LAYOUT = 'cols';

/**
 * @type {Number}
 *
 * Sets maximum number of rows or columns. The default value of "1", combined
 * with the default layout of "cols", will create a single column of images.
 */
var LIMIT = 1;

/**
 * @type {Number}
 *
 * The amount of spacing from column to column.
 */
var COL_SPACING = 100;

/**
 * @type {Number}
 *
 * The amount of spacing from row to row.
 */
var ROW_SPACING = 50;

/**
 * @type {String}
 *
 * Specifies the format for retrieving image coordinates. Accepted values:
 * - "css" (default)
 * - "json"
 */
var OUTPUT_FORMAT = 'css';

// Setup _____________________________________________________________________

#target photoshop
app.bringToFront();

// Internal Methods __________________________________________________________

/**
 * Displays the prompt to select the source folder for the image sprites and
 * returns the folder that has been selected.
 *
 * @return {Folder} The path of the selected folder
 */
function getFolder() {
    var default_path = '~';
    return Folder.selectDialog('Select the folder to be imported:', Folder(default_path));
}

/**
 * Checks to see if the current file is supported.
 *
 * @param {String} filename The name of the file
 * @return {Boolean} Whether or not the file is supported
 */
function isValidFile(filename) {

    var supported_types = ['.jpg', '.jpeg', '.gif', '.png', '.tif'],
        limit           = supported_types.length,
        i;

    for (i = 0; i < limit; i++) {
        if (filename.indexOf(supported_types[i]) !== -1) {
            return true;
        }
    }

    return false;

}

/**
 * Creates a new document (canvas) to add image sprites to.
 *
 * @return {Document} The newly created document
 */
function createCanvas() {

    var original_ruler_units    = preferences.rulerUnits,
        document_name           = 'sprite',
        document_width          = 10000,
        document_height         = 10000,
        document_resolution     = 72,
        canvas;

    preferences.rulerUnits  = Units.PIXELS;
    canvas                  = documents.add(document_width, document_height, document_resolution, document_name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT, 1);
    preferences.rulerUnits  = original_ruler_units;

    return canvas;

}

/**
 * Opens an image file and adds it as one of the sprites on the destination
 * sprite document, settings its position once added.
 *
 * @param {File} source_image The image layer to be added
 * @param {Document} destination_doc The final sprite document
 * @param {Object} coordinates Determines the position of the new layer
 */
function addLayer(source_image, destination_doc, coordinates) {

    var doc_ref,
        doc_name,
        doc_height,
        destination_layer,
        bounds,
        left_offset,
        top_offset;

    open(source_image);

    doc_ref     = activeDocument;
    doc_name    = doc_ref.name;
    doc_height  = doc_ref.height;

    doc_ref.changeMode(ChangeMode.RGB);

    // Duplicate layer into the new document
    doc_ref.activeLayer.duplicate(documents[destination_doc.name], ElementPlacement.PLACEATBEGINNING);
    doc_ref.close(SaveOptions.DONOTSAVECHANGES);

    // Name duplicate layer using the original document name (without the extension)
    destination_layer = destination_doc.activeLayer;
    destination_layer.name = doc_name.substring(0, doc_name.lastIndexOf('.'));

    // Determine the position of the newly added layer
    bounds      = destination_layer.bounds;
    left_offset = bounds[0] * -1;
    top_offset  = bounds[1] * -1;

    // Move the layer to (0, 0)
    destination_layer.translate(left_offset, top_offset);

    // Now move the layer to new position
    destination_layer.translate(coordinates.x, coordinates.y);

}

/**
 * Removes empty layer, shows all layers, and trims the document down to size.
 *
 * @param {Document} document The active sprite document
 */
function cleanUp(document) {
    document.artLayers[document.layers.length - 1].remove();
    document.revealAll();
    document.trim(TrimType.TRANSPARENT, true, true, true, true);
    app.runMenuItem(charIDToTypeID("ActP")); // zoom to 100%
}

/**
 * Outputs the coordinates of each layer in the scripting window (you will
 * have to copy & paste the output on your own.)
 *
 * @param {Document} doc The active sprite document
 */
function outputCoordinates(doc) {

    var i       = doc.layers.length - 1;
    var limit   = 0;
    var format  = OUTPUT_FORMAT.toLowerCase();

    if (format === 'json') {
        $.writeln('[');
    }

    for (i = doc.layers.length - 1; i >= limit; i--) {
        if (format === 'json') {
            $.writeln('{"layer": "' + doc.layers[i].name + '", "x": "' + doc.layers[i].bounds[0].toString().split(' ').join('') + '", "y": "-' + doc.layers[i].bounds[1].toString().split(' ').join('') + '"}');
            if (i > 0) {
                $.write(',');
            }
        }
        else {
            $.writeln('.' + doc.layers[i].name + ' {' + 'background-position: ' + "-" + doc.layers[i].bounds[0].toString().split(' ').join('') + " -" + doc.layers[i].bounds[1].toString().split(' ').join('') + ';' + '}');
        }
    }

    if (format === 'json') {
        $.writeln(']');
    }

}

/**
 * Builds the single sprite file.
 *
 * @param {Folder} folder The user-selected source folder
 */
function createSprite(folder) {

    var new_canvas = false,
        new_doc,
        doc_list,
        i,
        row_index,
        col_index,
        limit,
        image_file,
        valid_image,
        try_again;

    if (folder) {

        doc_list    = folder.getFiles();
        limit       = doc_list.length;
        col_index   = 0;
        row_index   = 0;

        for (i = 0; i < limit; i++) {

            image_file  = doc_list[i];
            valid_image = (image_file instanceof File) && isValidFile(image_file.name.toLowerCase());

            if (valid_image) {

                // Create new document if it doesn't already exist
                if (new_canvas === false) {
                    new_doc     = createCanvas();
                    new_canvas  = true;
                }

                // Add the new image as a layer and position it
                addLayer(image_file, new_doc, {
                    x: COL_SPACING * col_index,
                    y: ROW_SPACING * row_index
                });

                // Update indices to properly build out the grid
                if (LAYOUT === 'rows') {
                    if (++row_index % LIMIT === 0) {
                        row_index = 0;
                        col_index++;
                    }
                }
                else {
                    if (++col_index % LIMIT === 0) {
                        col_index = 0;
                        row_index++;
                    }
                }

            }

        }

        if (new_canvas) {
            cleanUp(new_doc);
            outputCoordinates(new_doc);
        }

    }
    else {

        try_again = confirm('The folder you selected does not contain any recognized image formats!\n\nSelect another folder...');

        if (try_again) {
            createSprite(getFolder());
        }

    }
}

// Initialization ____________________________________________________________

createSprite(getFolder());

/*jslint  */
/*globals $, ChangeMode, DocumentFill, ElementPlacement, File, Folder, NewDocumentMode, SaveOptions, TrimType, Units, activeDocument, app, charIDToTypeID, documents, preferences */
