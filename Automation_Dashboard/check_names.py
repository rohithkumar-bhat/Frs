import json
import os

def check_names():
    path = os.path.join('static', 'data.js')
    if not os.path.exists(path):
        print("data.js not found")
        return

    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        json_str = content.replace('const attendanceData = ', '').strip()
        if json_str.endswith(';'):
            json_str = json_str[:-1]
        
        try:
            data = json.loads(json_str)
        except Exception as e:
            print(f"JSON Parse Error: {e}")
            return

        names = [emp.get('Employee Name') for emp in data]
        target_names = [
            "Dantuluri Bhaskar Yashwanth Varma",
            "Jyothi Babu Reddy",
            "Punna Reddy",
            "Vasundhara Reddy"
        ]
        
        for name in target_names:
            print(f"'{name}' in data.js: {name in names}")

if __name__ == "__main__":
    check_names()
