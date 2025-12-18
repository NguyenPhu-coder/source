# Avatar 3D Models Directory

## 📁 Purpose

This directory stores 3D avatar model files used by the Avatar Teacher system.

## 🎨 Required Files

### 3D Models (GLB/GLTF Format)

Place your 3D avatar models here:

```
models/
├── default_teacher.glb       # Professional teacher avatar
├── casual_teacher.glb        # Friendly casual teacher
├── formal_teacher.glb        # Traditional formal teacher
├── default_teacher.png       # Preview thumbnail (256x256)
├── casual_teacher.png        # Preview thumbnail
└── formal_teacher.png        # Preview thumbnail
```

## 🔍 Model Specifications

### File Format Requirements:

- **Format**: GLB (Binary GLTF) or GLTF + bin + textures
- **Polygon Count**: 10,000 - 50,000 triangles (optimized for web)
- **Texture Size**: Max 2048x2048 pixels
- **File Size**: < 10MB per model (recommended)

### Required Components:

1. **Base Mesh**: Humanoid character model
2. **Skeleton/Armature**: Standard humanoid rig
3. **Animations** (embedded or separate):
   - `idle` - Neutral standing pose
   - `wave` - Greeting gesture
   - `pointing` - Pointing/directing attention
   - `scratch_head` - Thinking gesture
   - `thumbs_up` - Approval/congratulation
   - `clap` - Encouragement
   - `presenting` - Explaining with hands
   - `questioning` - Questioning pose

4. **Morph Targets** (for facial expressions):
   - Neutral, Happy, Thinking, Excited, Concerned, Confident

5. **Materials**: PBR materials with:
   - Base color
   - Normal map (optional)
   - Metallic/Roughness

## 🌐 Where to Get 3D Models

### Free Resources:

1. **Ready Player Me** - https://readyplayer.me/
   - Create custom avatars
   - Export as GLB
   - Free for personal/commercial use

2. **Mixamo** - https://www.mixamo.com/
   - Free rigged characters
   - Pre-made animations
   - Adobe account required

3. **Sketchfab** - https://sketchfab.com/
   - Search for "teacher avatar"
   - Filter by "Downloadable" + "GLB"
   - Check license (CC0, CC-BY recommended)

4. **Poly Pizza** - https://poly.pizza/
   - Low-poly characters
   - Free CC0 license
   - Great for performance

### Commercial Resources:

1. **TurboSquid** - https://www.turbosquid.com/
2. **CGTrader** - https://www.cgtrader.com/
3. **Renderpeople** - https://renderpeople.com/

## 🛠️ How to Add Models

### Method 1: Download from Ready Player Me

```bash
# 1. Go to https://readyplayer.me/
# 2. Create your avatar
# 3. Click "Download" → Choose "GLB" format
# 4. Rename and move to models/ folder

mv ~/Downloads/avatar.glb models/default_teacher.glb
```

### Method 2: Use Blender

```bash
# 1. Open Blender
# 2. Import FBX/OBJ model
# 3. Add armature and animations
# 4. Export as GLB:
#    - File → Export → glTF 2.0 (.glb/.gltf)
#    - Format: glTF Binary (.glb)
#    - Include: Selected Objects
#    - Transform: +Y Up
```

### Method 3: Download Free Models

```bash
# Example: Download from Sketchfab
# 1. Find model with "Download" option
# 2. Choose "Original format (glTF)"
# 3. Extract and rename

unzip model.zip
mv scene.glb models/casual_teacher.glb
```

## 📸 Creating Preview Images

Use Blender or online tools:

```bash
# In Blender:
# 1. Import GLB model
# 2. Set camera angle (front view)
# 3. Render → Render Image
# 4. Save as PNG (256x256 or 512x512)

# Or use online tool:
# https://gltf-viewer.donmccurdy.com/
# Load model → Screenshot → Crop to square
```

## 🧪 Testing Models

Test your models before deploying:

```bash
# Online GLTF Viewer
https://gltf-viewer.donmccurdy.com/

# Three.js Editor
https://threejs.org/editor/

# Babylon.js Sandbox
https://sandbox.babylonjs.com/
```

## 🚀 After Adding Models

1. **Update avatar_teacher_agent.py** if needed
2. **Restart the avatar agent**:
   ```bash
   docker-compose restart avatar-teacher-agent
   ```

3. **Test in frontend**:
   - Open Avatar Customizer
   - Select different models
   - Verify 3D rendering

## 📝 Model Naming Convention

Use descriptive names:

```
{style}_{type}_{variant}.glb

Examples:
- professional_teacher_male.glb
- casual_teacher_female.glb
- formal_instructor_neutral.glb
- animated_tutor_friendly.glb
```

## 🔒 License & Attribution

**Important**: Always check model licenses!

- ✅ **CC0** - Public domain, no attribution needed
- ✅ **CC-BY** - Free, attribution required
- ✅ **MIT** - Free, attribution required
- ⚠️ **CC-BY-NC** - Non-commercial use only
- ❌ **All Rights Reserved** - Cannot use without permission

Save license info in:
```
models/LICENSES.txt
```

## 🎯 Quick Start Example

1. **Download sample models**:
   ```bash
   # Professional teacher from Ready Player Me
   wget https://models.readyplayer.me/... -O default_teacher.glb
   ```

2. **Create preview**:
   ```bash
   # Use online viewer to screenshot
   # Save as default_teacher.png
   ```

3. **Test**:
   ```bash
   # Start agent
   docker-compose up avatar-teacher-agent
   
   # Check models endpoint
   curl http://localhost:8019/api/avatar/models
   ```

## 🆘 Troubleshooting

### Model not loading in browser:

- ✅ Check file size (< 10MB recommended)
- ✅ Verify GLB format (not FBX or OBJ)
- ✅ Test in online viewer first
- ✅ Check browser console for errors

### Animations not playing:

- ✅ Ensure animations are embedded in GLB
- ✅ Check animation names match code
- ✅ Verify armature is properly rigged

### Poor performance:

- ✅ Reduce polygon count (< 50k triangles)
- ✅ Compress textures (use Draco compression)
- ✅ Remove unnecessary materials
- ✅ Use LOD (Level of Detail) models

## 📚 Additional Resources

- [Three.js GLB/GLTF Guide](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)
- [GLTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Ready Player Me Documentation](https://docs.readyplayer.me/)
- [Mixamo Tutorial](https://www.mixamo.com/faq)

---

**Status**: 📁 Folder ready, waiting for 3D models  
**Last Updated**: December 2024
