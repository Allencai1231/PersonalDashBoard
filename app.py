import os
import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DATA_FILE = 'data.json'

@app.route('/')
def index():
    # 这一步对应日志里的 "GET /"
    return render_template('index.html')

@app.route('/api/get_data', methods=['GET'])
def get_data():
    # 这一步是前端JS加载后应该调用的，日志里缺这个说明JS没跑起来
    if not os.path.exists(DATA_FILE):
        default_data = {"memo": "", "links": []}
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_data, f)
        return jsonify(default_data)
    
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except:
        return jsonify({"memo": "", "links": []})

@app.route('/api/save_data', methods=['POST'])
def save_data():
    data = request.json
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return jsonify({"status": "success"})

@app.route('/api/open_app', methods=['POST'])
def open_app():
    target = request.json.get('path')
    if not target:
        return jsonify({"status": "error", "message": "路径为空"})
    try:
        os.startfile(target)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    print("系统启动成功！")
    print("本地访问: http://127.0.0.1:5000")
    # host='0.0.0.0' 允许局域网访问
    app.run(host='0.0.0.0', port=5000, debug=True)