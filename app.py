import os
import json
from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for
from functools import wraps

app = Flask(__name__)
# 设置密钥用于会话加密
app.secret_key = 'your-secret-key-here-please-change-in-production'
DATA_FILE = 'data.json'

# 验证账号密码
VALID_USERNAME = "AllenCai1231"
VALID_PASSWORD = "Allen20080813"

def login_required(f):
    """装饰器：检查用户是否已登录"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login', methods=['GET', 'POST'])
def login():
    """登录页面和处理"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == VALID_USERNAME and password == VALID_PASSWORD:
            session['logged_in'] = True
            session['username'] = username
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": "账号或密码错误"}), 401
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """退出登录"""
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    # 这一步对应日志里的 "GET /"
    return render_template('index.html')

@app.route('/api/get_data', methods=['GET'])
@login_required
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
@login_required
def save_data():
    data = request.json
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return jsonify({"status": "success"})

@app.route('/api/open_app', methods=['POST'])
@login_required
def open_app():
    target = request.json.get('path')
    if not target:
        return jsonify({"status": "error", "message": "路径为空"})
    try:
        os.startfile(target)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# 音乐播放器相关API
@app.route('/api/get_music_playlists', methods=['GET'])
@login_required
def get_music_playlists():
    """获取所有播放列表（Music目录下的子目录）"""
    music_dir = os.path.join(os.getcwd(), 'Music')
    if not os.path.exists(music_dir):
        os.makedirs(music_dir)
        return jsonify([])
    
    playlists = []
    for item in os.listdir(music_dir):
        item_path = os.path.join(music_dir, item)
        if os.path.isdir(item_path):  # 只取目录作为播放列表
            playlist = {
                'name': item,
                'path': item_path,
                'songs': []
            }
            # 获取该目录下所有音频文件
            for file in os.listdir(item_path):
                if file.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac')):
                    song_path = os.path.join(item_path, file)
                    playlist['songs'].append({
                        'title': file[:-4],  # 去掉扩展名作为标题
                        'filename': file,
                        'relative_path': f"{item}/{file}",  # 相对路径用于前端请求
                        'path': song_path,
                        'duration': 0  # 可后续添加时长信息
                    })
            playlists.append(playlist)
    
    return jsonify(playlists)

@app.route('/music/<path:relative_path>')
@login_required
def serve_music(relative_path):
    """提供音乐文件服务"""
    # 从相对路径构建完整路径
    music_path = os.path.join(os.getcwd(), 'Music', relative_path)
    if os.path.exists(music_path):
        return send_file(music_path)
    else:
        return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    print("系统启动成功！")
    print("本地访问: http://127.0.0.1:5000")
    # host='0.0.0.0' 允许局域网访问
    app.run(host='0.0.0.0', port=5000, debug=True)