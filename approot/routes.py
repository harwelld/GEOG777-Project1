from json import load
from os import path
import subprocess

from flask import current_app as app
from flask import request, render_template


gp_service_path = path.abspath(path.join(path.dirname(__file__), '..', 'gp_service.bat'))
gp_result_path = path.abspath(path.join(path.dirname(__file__), '..', 'gp_result.json'))


@app.route('/')
def default():
	return render_template('map.html')


@app.route('/api/run-gp-service', methods=['POST'])
def get_nitrate_points():
	if request.method == 'POST':
		print(request)
		power = request.form['decay-coefficient']
		print(power)
		gpTask = subprocess.Popen(
			[gp_service_path, power],
			shell = True,
			stdout = subprocess.PIPE
		)
		for line in gpTask.stdout:
			if 'Done' in str(line):
				print('Done')
				with open(gp_result_path) as gp_result_json:
					gp_result = load(gp_result_json)
					if gp_result['gp-result'] == 'success':
						return({'gp-result': 'success'})
		return({'gp-result': 'failed'})


@app.route('/glr-result', methods=['GET'])
def glr_result():
	return render_template('glr_result.html')
