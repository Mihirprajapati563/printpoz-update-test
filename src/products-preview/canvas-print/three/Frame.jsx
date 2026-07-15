import React, { useRef, useState, useEffect } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { useControls } from "leva";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export function Frame({ image, frameSize, height, thickness }) {
  const { nodes } = useGLTF("/3d/frame2.glb");
  const container = useRef(null);
  const texture = useTexture(image);
  if (
    frameSize == undefined ||
    frameSize == null ||
    frameSize == {} ||
    frameSize == []
  ) {
    frameSize = { width: 1, height: 1 };
  }

  const selectedThickness = "200";

  const frameThickness = {
    '0.25"': 0.5,
    '0.5"': 1.0,
    '0.75"': 1.5,
    '1.0"': 2.0,
    '1.25"': 2.5,
    '1.5"': 3.0,
    '1.75"': 3.5,
    '2.0"': 4.0,
  };

  const baseSize = 2;
  const centerWidth = frameSize.width - parseInt(thickness) * 2;
  const centerHeight = frameSize.height - parseInt(thickness) * 2;

  const [aspectX, aspectY] = [centerHeight, centerWidth];
  const customThickness = frameThickness[selectedThickness] || 2;

  const scaleX = (aspectX / Math.max(aspectX, aspectY)) * baseSize;
  const scaleY = (aspectY / Math.max(aspectX, aspectY)) * baseSize;

  useFrame(() => {
    container.current.rotation.y += 0.003;
  });

  return (
    <group ref={container}>
      <group
        dispose={null}
        scale={[scaleX, customThickness, scaleY]}
        rotation={[Math.PI / 2, -Math.PI / 2, 0]}
      >
        {/* <mesh geometry={nodes.Plane.geometry} material={nodes.Plane.material}>
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={nodes.Plane001.geometry} material={nodes.Plane001.material}>
          <meshStandardMaterial roughness={0.9} color="#826a42" side={THREE.DoubleSide} />
        </mesh>
        <mesh
          geometry={nodes.Object_2001.geometry}
          material={nodes.Object_2001.material}
          position={[-0.915, -0.126, -0.016]}
          rotation={[-1.56, -1.243, 0.004]}
          scale={0.203} >
          <meshStandardMaterial metalness={1.0} roughness={0.2} />
        </mesh> */}

        <mesh geometry={nodes.Plane.geometry} material={nodes.Plane.material}>
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
        </mesh>
        <mesh
          geometry={nodes.Plane001.geometry}
          material={nodes.Plane001.material}
        >
          <meshStandardMaterial
            roughness={0.9}
            color="#826a42"
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          geometry={nodes.Object_2001.geometry}
          material={nodes.Object_2001.material}
          position={[-0.915, -0.126, -0.016]}
          rotation={[-1.56, -1.243, 0.004]}
          scale={0.203}
        >
          <meshStandardMaterial metalness={1.0} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload("/3d/frame2.glb");
