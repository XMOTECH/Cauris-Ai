#!/usr/bin/env python3
"""
Script pour vérifier le contenu de la collection Qdrant
"""
from qdrant_client import QdrantClient

def main():
    client = QdrantClient(url="http://localhost:6333")

    # Vérifier si la collection existe
    collections = client.get_collections()
    print("Collections disponibles :")
    for collection in collections.collections:
        print(f"- {collection.name}")

    # Détails de la collection documents
    if client.collection_exists("documents"):
        info = client.get_collection("documents")
        print(f"\nCollection 'documents' :")
        print(f"- Points : {info.points_count}")
        print(f"- Vecteurs : {info.config.params.vectors}")

        # Récupérer quelques points
        points = client.scroll(
            collection_name="documents",
            limit=5,
            with_payload=True,
            with_vectors=False
        )

        print(f"\nExemples de points indexés :")
        for point in points[0]:
            print(f"ID: {point.id}")
            print(f"Payload: {point.payload}")
            print("---")
    else:
        print("Collection 'documents' n'existe pas")

if __name__ == "__main__":
    main()