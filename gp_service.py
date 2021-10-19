# ---------------------------------------------------------------------------
# Name:        gp_service.py
#
# Purpose:     Geoprocessing service to determine the possible relationship
#              between nitrate concentration in groundwater and cancer rates
#              per census tract in the state of Wisconsin.
#
# Usage:       This script must be run within the arcgispro-py3 envrironment.
#              Called via batch script.
#
# Author:      Dylan Harwell - UW Madison - GEOG777 - Fall 2021
# ---------------------------------------------------------------------------

from arcpy import env, GetMessages
from arcpy.management import AddJoin
from arcpy.sa import Idw, ZonalStatisticsAsTable
from arcpy.stats import GeneralizedLinearRegression, GWR, OrdinaryLeastSquares
                        
from arcgis.gis import GIS

from json import dump
from os import getenv, path
from shutil import make_archive


# Set data paths
base_dir = path.abspath(path.dirname(__file__))
data_dir = path.join(base_dir, 'approot', 'data')
result_dir = path.join(data_dir, 'project1_result')
working_gdb = path.join(data_dir, 'Project1.gdb')
well_nitrate = 'well_nitrate_prj'
cancer_tracts = 'cancer_tracts_prj'
idw_output = 'idw_output'
zonal_stats_table = 'zonal_stats_table'
tracts_joined = 'cancer_tracts_joined'
cancer_nitrate_result = path.join(result_dir, 'cancer_nitrate.shp')
glr_result = path.join(data_dir, 'glr_result.txt')
gp_result_json = path.join(base_dir, 'gp_result.json')


# Geoprocessing environment settings
env.workspace = working_gdb
env.extent = cancer_tracts
env.overwriteOutput = True


try:
    # Step 1: Create IDW interpolated surface from well nitrate samples
    power = float(getenv('DECAY_COEFFICIENT')) if getenv('DECAY_COEFFICIENT') else 1.5  ## if/else here for testing
    outIDW = Idw(
        in_point_features = well_nitrate,
        z_field = 'nitr_ran',
        cell_size = 300,
        power = power
    ).save(idw_output)


    # Step 3: Get average nitrate value in each tract
    geoid_field = 'GEOID10'
    ZonalStatisticsAsTable(
        in_zone_data = cancer_tracts,
        zone_field = geoid_field,
        in_value_raster = idw_output,
        out_table = zonal_stats_table,
        ignore_nodata = 'DATA',
        statistics_type = 'MEAN'
    )


    # Step 4: Join zonal stats table to tracts
    tracts_join_lyr = AddJoin(
        in_layer_or_view = cancer_tracts,
        in_field = geoid_field,
        join_table = zonal_stats_table,
        join_field = geoid_field,
        join_type = 'KEEP_ALL'
    )


    # Step 6: Perform regression analysis (linear or geographic)
    # regression_type = getenv('REGRESSION_TYPE') ## TODO: Give user choice between GLR/GWR analysis
    regression_type = 'GLR'
    if regression_type == 'GLR':
        GeneralizedLinearRegression(
            in_features = tracts_join_lyr,
            dependent_variable = 'cancer_tracts_prj.canrate',
            model_type = 'CONTINUOUS',
            output_features = cancer_nitrate_result,
            explanatory_variables = 'zonal_stats_table.MEAN',
        )
        # Write tool messages to txt file then to html template
        with open(glr_result, 'w+') as result_file:
            result_file.write(GetMessages())
        with open(glr_result) as txt_file:
            with open(path.join(base_dir, 'approot', 'templates', 'glr_result.html'), 'w+') as result:
                for line in txt_file.readlines():
                    result.write('<pre>'+line+'</pre>')

    elif regression_type == 'GWR':
        pass


    # Step 7: Zip result layer
    make_archive(result_dir, 'zip', result_dir)


    # Step 8: Publish result to AGOL as hosted layer
    # NOTE: publish(overwrite=True) has a bug, it fails to overwrite
    gis = GIS(
        url = getenv('AGOL_URL'),
        username = getenv('AGOL_UN'),
        password = getenv('AGOL_PW')
    )

    glr_items = gis.content.search(query='title:project1_result')
    if len(glr_items) > 0:
        for item in glr_items:
            item.delete()

    glr_zip_item = gis.content.add({}, f'{result_dir}.zip')
    glr_zip_item.publish()

    glr_items = gis.content.search(query='title:project1_result')
    for item in glr_items:
        item.share(everyone=True)


    # Log geoprocessing result to json file
    with open(gp_result_json, 'w+') as file:
        data = {
            'gp-result': 'success',
            'error': False
        }
        dump(data, file, indent=3)


except Exception as e:
    # Log any errors to json file
    with open(gp_result_json, 'w+') as file:
        data = {
            'gp-result': 'failed',
            'error': True,
            'exception': str(e)
        }
        dump(data, file, indent=3)
