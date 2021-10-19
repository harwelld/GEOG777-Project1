from os import getenv, path
from dotenv import load_dotenv

basedir = path.abspath(path.dirname(__file__))
load_dotenv(path.join(basedir, '.env'))


class Config(object):
    """Base configuration."""
    FLASK_ENV = getenv('FLASK_ENV')
    SECRET_KEY = getenv('SECRET_KEY')
    WTF_CSRF_SECRET_KEY = getenv('WTF_CSRF_SECRET_KEY')
    STATIC_FOLDER = 'static'
    TEMPLATES_FOLDER = 'templates'


class ProdConfig(Config):
    DEBUG = False
    TESTING = False
    DATABASE_URI = getenv('PROD_DATABASE_URI')


class StageConfig(Config):
    DEBUG = False
    TESTING = True
    DATABASE_URI = getenv('STAGE_DATABASE_URI')


class DevConfig(Config):
    DEBUG = True
    TESTING = True
    DATABASE_URI = getenv('DEV_DATABASE_URI')
