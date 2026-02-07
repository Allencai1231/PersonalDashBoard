import os
import json
from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for
from functools import wraps

app = Flask(__name__)
# 设置密钥用于会话加密
app.secret_key = 'your-secret-key-here-please-change-in-production'
DATA_FILE = 'data.json'

def load_data():
    """加载数据文件"""
    if not os.path.exists(DATA_FILE):
        # 创建默认数据文件（不硬编码用户信息）
        default_data = {
            "users": [],
            "notes": [],
            "note_categories": [],
            "software": [],
            "websites": []
        }
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, ensure_ascii=False, indent=4)
        return default_data
    
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {"users": [], "notes": [], "note_categories": [], "software": [], "websites": []}

def save_data(data):
    """保存数据到文件"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def get_user_by_username(username):
    """根据用户名获取用户信息"""
    data = load_data()
    for user in data.get('users', []):
        if user['username'] == username:
            return user
    return None

def add_user(username, password, role='user'):
    """添加新用户"""
    data = load_data()
    if not data.get('users'):
        data['users'] = []
    
    # 检查用户名是否已存在
    for user in data['users']:
        if user['username'] == username:
            return False
    
    new_user = {
        'username': username,
        'password': password,
        'role': role,
        'created_at': '2026-02-07'
    }
    data['users'].append(new_user)
    save_data(data)
    return True

def login_required(f):
    """装饰器：检查用户是否已登录"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """装饰器：检查用户是否为管理员"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session or session.get('role') != 'admin':
            return jsonify({"status": "error", "message": "权限不足"}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/register', methods=['GET', 'POST'])
def register():
    """注册页面和处理"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            return jsonify({"status": "error", "message": "用户名和密码不能为空"}), 400
        
        if len(username) < 3 or len(password) < 6:
            return jsonify({"status": "error", "message": "用户名至少3位，密码至少6位"}), 400
        
        # 添加普通用户（非管理员）
        if add_user(username, password, 'user'):
            return jsonify({"status": "success", "message": "注册成功，请登录"})
        else:
            return jsonify({"status": "error", "message": "用户名已存在"}), 409
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """登录页面和处理"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = get_user_by_username(username)
        if user and user['password'] == password:
            session['logged_in'] = True
            session['username'] = username
            session['role'] = user['role']
            return jsonify({"status": "success", "role": user['role']})
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
    data = load_data()
    # 移除用户信息，不返回给前端
    if 'users' in data:
        del data['users']
    return jsonify(data)

@app.route('/api/save_data', methods=['POST'])
@admin_required
def save_data_api():
    data = request.json
    # 加载现有数据并保留用户信息
    existing_data = load_data()
    users = existing_data.get('users', [])
    
    # 合并数据，保留用户信息
    data['users'] = users
    save_data(data)
    return jsonify({"status": "success"})

@app.route('/api/open_app', methods=['POST'])
@admin_required
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

@app.route('/api/get_user_info', methods=['GET'])
@login_required
def get_user_info():
    """获取当前用户信息"""
    return jsonify({
        'username': session.get('username'),
        'role': session.get('role')
    })

if __name__ == '__main__':
    print("系统启动成功！")
    print("本地访问: http://127.0.0.1:5000")
    # host='0.0.0.0' 允许局域网访问
    app.run(host='0.0.0.0', port=5000, debug=True)