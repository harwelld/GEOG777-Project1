"""Flask Application Factory pattern."""
from flask import Flask


# Globally accessible libraries/plugins go here


def init_app():
    """Initialize the core application."""
    app = Flask(__name__, instance_relative_config=False)
    
    # Flask will default to production ENV unless explicitly set
    if app.config['ENV'] == 'development':
        app.config.from_object('config.DevConfig')
    elif app.config['ENV'] == 'testing':
        app.config.from_object('config.StageConfig')
    else:
        app.config.from_object('config.ProdConfig')

    # Initialize any Plugins here

    with app.app_context():
        # Import Controllers here
        from . import routes

        return app
