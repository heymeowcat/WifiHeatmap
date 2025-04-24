import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { HeatmapDataPoint } from '../types/heatmap';

interface Heatmap3DProps {
  width: number;
  height: number;
  data: HeatmapDataPoint[];
  floorPlanDimensions: { width: number; height: number };
}

const Heatmap3D: React.FC<Heatmap3DProps> = ({
  width,
  height,
  data,
  floorPlanDimensions,
}) => {
  const webViewRef = useRef<WebView>(null);

  // When data changes, update the WebView
  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        updateHeatmapData(${JSON.stringify(data)});
        true;
      `);
    }
  }, [data]);

  // HTML content for the WebView with Three.js
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body { margin: 0; overflow: hidden; }
        canvas { width: 100%; height: 100%; display: block; }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.min.js"></script>
    </head>
    <body>
      <script>
        // Initialize Three.js scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, ${width} / ${height}, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(${width}, ${height});
        renderer.setClearColor(0xf0f0f0);
        document.body.appendChild(renderer.domElement);

        // Add orbit controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;

        // Set camera position
        camera.position.set(0, 10, 10);
        camera.lookAt(0, 0, 0);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Create floor plane
        const floorWidth = ${floorPlanDimensions.width / 100};
        const floorHeight = ${floorPlanDimensions.height / 100};
        const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xeeeeee,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(Math.max(floorWidth, floorHeight), 10);
        scene.add(gridHelper);

        // Store heatmap points
        let heatmapPoints = [];

        // Function to update heatmap data
        function updateHeatmapData(data) {
          // Remove existing heatmap points
          heatmapPoints.forEach(point => scene.remove(point));
          heatmapPoints = [];

          // Add new heatmap points
          data.forEach(point => {
            // Normalize coordinates to center of floor
            const x = (point.x / ${floorPlanDimensions.width}) * floorWidth - (floorWidth / 2);
            const z = (point.y / ${floorPlanDimensions.height}) * floorHeight - (floorHeight / 2);
            
            // Calculate height based on signal strength
            const normalizedStrength = (point.strength + 100) / 70;
            const height = normalizedStrength * 2;
            
            // Create color based on signal strength
            let color;
            if (normalizedStrength > 0.7) {
              color = 0x00C781; // Strong - Green
            } else if (normalizedStrength > 0.4) {
              color = 0x33A1FD; // Medium - Blue
            } else {
              color = 0xFF4949; // Weak - Red
            }
            
            // Create cylinder for signal point
            const geometry = new THREE.CylinderGeometry(0.1, 0.1, height, 16);
            const material = new THREE.MeshStandardMaterial({ 
              color: color,
              transparent: true,
              opacity: 0.7
            });
            const cylinder = new THREE.Mesh(geometry, material);
            cylinder.position.set(x, height / 2, z);
            
            scene.add(cylinder);
            heatmapPoints.push(cylinder);
          });
        }

        // Animation loop
        function animate() {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();

        // Handle window resize
        window.addEventListener('resize', () => {
          camera.aspect = ${width} / ${height};
          camera.updateProjectionMatrix();
          renderer.setSize(${width}, ${height});
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { width, height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  webView: {
    flex: 1,
  },
});

export default Heatmap3D;